---
title: "Multi-Cluster Kubernetes Explained: Networking, Storage, and Disaster Recovery with Cilium ClusterMesh"
date: 2026-08-30
description: "A production-focused implementation guide for connecting Kubernetes clusters without forgetting the stateful half of the problem."
---

_Originally published on [Medium](https://medium.com/@mehdisamadiarchitect/multi-cluster-kubernetes-explained-networking-storage-and-disaster-recovery-with-cilium-b2dad729c372)._

Multi-cluster Kubernetes is often introduced as a networking problem: connect Cluster A to Cluster B, discover services across both clusters, and fail traffic over when one site becomes unhealthy.

That is necessary, but it is not enough.

A disaster-recovery design is only complete when **traffic, application state, persistent storage, artifacts, and operational dependencies** can survive the same failure.

That distinction matters in real infrastructure. Cilium ClusterMesh can make a backend in another cluster reachable, but it does not replicate the contents of a PostgreSQL PVC. A global service can redirect requests to another region, but it cannot make a database replica consistent. A second Kubernetes cluster is not a backup simply because it exists.

This article builds a complete mental model for multi-cluster Kubernetes and then walks through a practical implementation using **Cilium**, **ClusterMesh**, **Global Services**, **cluster-aware network policy**, **Hubble**, and a separate storage/DR architecture using technologies such as **Rook-Ceph**, **Longhorn**, **Velero**, and application-native database replication.

It is also written with a pragmatic operational assumption: critical recovery procedures should not depend on external registries, cloud APIs, or SaaS endpoints being reachable at exactly the moment your infrastructure is already under stress.

## Why Multi-Cluster Kubernetes?

A single Kubernetes cluster can scale very far, so the strongest reason to add clusters is usually not raw capacity. It is **failure-domain design**.

Organizations commonly move to multiple clusters for:

- geographic distribution and lower latency;
- regional or site-level disaster recovery;
- hard isolation between production, staging, tenants, or business units;
- compliance and data-residency boundaries;
- independent upgrade and lifecycle domains;
- organizational growth, acquisitions, and hybrid infrastructure;
- avoiding an excessively large blast radius.

The key idea is that each Kubernetes cluster remains operationally independent. Multi-cluster architecture then adds selected connectivity between those clusters instead of merging them into one control plane.

A useful way to think about it is:

```text
Single cluster:

Applications
    |
One Kubernetes control plane
    |
One cluster failure domain

Multi-cluster:

Applications
    |
+-----------+-----------+
|           |           |
Cluster A   Cluster B   Cluster C
Region A    Region B    Staging
```

The goal is not to connect everything to everything. The goal is to create the right boundaries and then deliberately connect only what must communicate.

## Common Multi-Cluster Patterns

### Active-active

Two or more clusters serve production traffic simultaneously.

```
Users
                   |
            Global Traffic
                   |
         +---------+---------+
         |                   |
     Cluster A           Cluster B
       ACTIVE              ACTIVE
         |                   |
     frontend            frontend
     backend             backend
```

This pattern is attractive for globally distributed stateless services and for applications that need very high availability.

Its hardest problem is usually not Kubernetes. It is **data consistency**.

If both sites process writes, the database, message system, or object store must have a clear replication and conflict model.

### Active-standby

One cluster is the normal production site while another is prepared to take over.

```
Users
                |
                v
            Cluster A
             ACTIVE
                |
         application state
                |
          replication
                |
                v
            Cluster B
             STANDBY
```

For stateful applications, active-standby is often simpler because there is a clear primary writer and a controlled promotion procedure.

### Cluster per environment

Development, staging, and production are separated into different clusters. This creates a stronger boundary than namespaces alone and prevents lifecycle mistakes from leaking directly into production.

### Cluster per region or site

Each region or physical location gets its own cluster. This improves latency and creates clear geographic failure domains.

### Cluster per tenant

Each customer or business unit receives a dedicated cluster. This is appropriate where hard multitenancy is required.

### Hub and spoke

A central cluster hosts selected shared platform services while workload clusters remain spokes.

```
Hub Cluster
          +-----------------------------+
          | Observability               |
          | Secrets / shared services   |
          | CI/CD                       |
          | DNS                         |
          +--------------+--------------+
                         |
                  ClusterMesh
                         |
          +--------------+--------------+
          |              |              |
       Spoke A         Spoke B        Spoke C
```

Not every spoke needs to communicate with every other spoke. That can significantly reduce the security blast radius.

## Where Cilium ClusterMesh Fits

Cilium ClusterMesh extends Cilium networking across multiple Kubernetes clusters. It provides:

- pod-to-pod connectivity across clusters;
- cross-cluster service discovery and load balancing;
- cluster-aware identity and network-policy enforcement;
- locality controls with service affinity;
- observability through Hubble.

The important design choice is that the **data plane is distributed**. Application packets can travel directly between worker nodes rather than being forced through a central application proxy for every east-west request.

![Cilium ClusterMesh connecting heterogeneous Kubernetes environments](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*0XABA-B-Z94FZ_ZN9EQoEw.png)

_Figure 1. Cilium ClusterMesh connecting heterogeneous Kubernetes environments across Azure, AWS, OpenShift, and VMware. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

ClusterMesh is built around a per-cluster control plane hosted by `clustermesh-apiserver`. Each cluster exposes selected local state to remote clusters and learns remote state from its peers.

Conceptually:

```text
CLUSTER A                        CLUSTER B

        Kubernetes API                  Kubernetes API
              |                               |
              v                               v
       Cilium Operator                 Cilium Operator
              |                               |
      ClusterMesh API <---- state ----> ClusterMesh API
              |                               |
              v                               v
        Cilium Agent                     Cilium Agent
              |                               |
          eBPF datapath  ---- traffic ---> eBPF datapath
              |                               |
           Pod A                            Pod B
```

This separation between control plane and data plane is one of the most important things to understand about ClusterMesh.

## ClusterMesh Internal Architecture

The `clustermesh-apiserver` exposes cluster state securely to remote clusters. In Cilium, the ClusterMesh control plane uses mTLS between clusters, and each cluster needs a unique human-readable name and numeric cluster ID.

![Global service load balancing and failover across two clusters](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*F4JUIKKb41Nyc3GeKWtU5w.png)

_Figure 2. Global service load balancing and failover across two clusters. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

![ClusterMesh control-plane synchronization and node-to-node connectivity](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*0uVStXuh0EHkkr6GI3S_hg.png)

_Figure 3. Internal ClusterMesh architecture showing per-cluster control-plane state synchronization and direct node-to-node datapath connectivity. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

A critical distinction is:

```
ClusterMesh etcd
        !=
Kubernetes application data
        !=
PersistentVolume replication
```

The ClusterMesh control-plane data store exists to exchange networking-related information. It should never be confused with the application’s database or persistent storage.

## Network Prerequisites Before You Enable ClusterMesh

Most ClusterMesh failures begin before `cilium clustermesh enable` is ever executed.

### 1. Non-overlapping Pod CIDRs

Standard ClusterMesh expects globally unique pod addresses across connected clusters.

Good:

```
Cluster A Pod CIDR: 10.10.0.0/16
Cluster B Pod CIDR: 10.20.0.0/16
```

Bad:

```
Cluster A Pod CIDR: 10.10.0.0/16
Cluster B Pod CIDR: 10.10.0.0/16
```

Address planning should happen before cluster creation, not during a disaster-recovery project six months later.

### 2. Node-to-node connectivity

Nodes in connected clusters need IP connectivity using their configured node addresses. Depending on the infrastructure, this might be provided by:

- VPC/VNet peering;
- routed private WAN connectivity;
- IPsec or WireGuard tunnels;
- MPLS/private interconnect;
- on-prem routing.

ClusterMesh does not magically bypass a firewall or a missing route.

### 3. Same datapath mode

Connected clusters should use a compatible Cilium datapath architecture. Mixing assumptions about encapsulation and native routing increases operational complexity.

### 4. Compatible Cilium versions

Cilium documents that connected ClusterMesh members should differ by no more than one minor release.

### 5. Unique cluster identity

Every cluster needs a unique `cluster.name` and `cluster.id`.

## Tunnel Mode vs Native Routing

In tunnel mode, Cilium encapsulates pod traffic in VXLAN or Geneve. The underlying network mostly needs to route node IP addresses.

```
Pod A (10.10.1.15)
        |
     Node A
        |
   VXLAN/Geneve
        |
     Node B
        |
Pod B (10.20.3.25)
```

This is usually easier across heterogeneous infrastructure.

With native routing, the underlay knows how to route the Kubernetes pod networks directly:

```
10.10.0.0/16 ---- router/WAN ---- 10.20.0.0/16
```

Native routing removes encapsulation overhead but requires more control over the underlying network.

![Cross-cluster pod connectivity with synchronized state](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*qmw491sGBo4KqXhwYJf4ZQ.png)

_Figure 4. Cross-cluster pod connectivity with synchronized service, endpoint, and identity state. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

## Hands-On: Build a Two-Cluster Cilium ClusterMesh

Assume two kubeconfig contexts:

```
export CLUSTER1=prod-a
export CLUSTER2=prod-b
```

First, verify both clusters:

```
kubectl --context $CLUSTER1 get nodes -o wide
kubectl --context $CLUSTER2 get nodes -o wide
```

Install the same Cilium release in both clusters and assign each cluster a unique identity:

```bash
cilium install --version 1.20.1 \
  --set cluster.name=$CLUSTER1 \
  --set cluster.id=1 \
  --context $CLUSTER1

cilium install --version 1.20.1 \
  --set cluster.name=$CLUSTER2 \
  --set cluster.id=2 \
  --context $CLUSTER2
```

Validate both installations:

```
cilium status --context $CLUSTER1 --wait
cilium status --context $CLUSTER2 --wait
```

Enable ClusterMesh in both clusters:

```
cilium clustermesh enable --context $CLUSTER1
cilium clustermesh enable --context $CLUSTER2
```

Connect the clusters:

```
cilium clustermesh connect \
  --context $CLUSTER1 \
  --destination-context $CLUSTER2
```

The connection only needs to be initiated in one direction; Cilium establishes the relationship in both directions.

Validate the mesh:

```
cilium clustermesh status --context $CLUSTER1 --wait
cilium clustermesh status --context $CLUSTER2 --wait
```

Then run the multi-cluster connectivity test:

```
cilium connectivity test \
  --context $CLUSTER1 \
  --multi-cluster $CLUSTER2
```

This is far more useful than proving that one pod can ping one IP address. The connectivity suite validates actual Cilium and Kubernetes networking behavior across the mesh.

## Global Services: One Kubernetes Service, Backends in Multiple Clusters

Suppose `inventory-api` is deployed in both clusters.

Create the same Kubernetes Service name and namespace in each cluster and add the Cilium Global Service annotation:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: inventory-api
  namespace: production
  annotations:
    service.cilium.io/global: "true"
spec:
  selector:
    app: inventory-api
  ports:
    - name: http
      port: 80
      targetPort: 8080
```

Applications continue using the normal Kubernetes service name:

```
inventory-api.production.svc.cluster.local
```

Cilium can include healthy remote backends in the load-balancing decision.

![Global Service distributing traffic across two clusters](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*USpAOs3clnN_3O6Q_LHM_A.png)

_Figure 5. A Global Service distributing traffic across endpoints in two clusters. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

Global Services handle service discovery and east-west backend selection; they do not provide internet-facing site failover. If an entire cluster becomes unavailable, an external DNS, load-balancer, or gateway layer must stop sending ingress traffic to that site and direct clients to a surviving cluster.

By default, Cilium retains the last-known service information when a remote cluster disconnects. For a production failover design, consider setting `clustermesh.cacheTTL` so stale remote backends are revoked after an appropriate interval. Choose the interval carefully: a short TTL removes failed endpoints sooner, while a longer TTL tolerates transient control-plane or WAN interruptions.

Cilium also supports the Kubernetes Multi-Cluster Services API (MCS-API). With MCS-API, services are exported/imported using the standardized `ServiceExport` and `ServiceImport` resources and are discoverable under the `clusterset.local` domain.

For platform teams trying to stay closer to Kubernetes SIG standards, MCS-API is worth evaluating alongside Cilium-specific Global Services.

## Prefer Local Traffic and Keep Remote Capacity for Failover

Cross-site traffic costs latency and often bandwidth or egress money. Sending every internal request to a remote cluster just because you can is usually not desirable.

Cilium service affinity lets you prefer local backends:

```
metadata:
  annotations:
    service.cilium.io/global: "true"
    service.cilium.io/affinity: "local"
```

With `local` affinity, Cilium prefers healthy local endpoints and uses remote endpoints when the local set is unavailable.

![Global Service preferring local endpoints](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*7S8D1sd3CAEC1DV9D5YAqg.png)

_Figure 6. Local backends are preferred; remote endpoints are used as spillover/failover capacity. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

This is a strong fit for active-standby and locality-first designs.

## Cross-Cluster Network Policy

Connectivity must not imply trust.

Cilium exposes the cluster name through the workload identity label:

```
io.cilium.k8s.policy.cluster
```

That lets you authorize communication to a specific workload in a specific cluster.

Example:

```yaml
apiVersion: cilium.io/v2
kind: CiliumNetworkPolicy
metadata:
  name: frontend-to-remote-inventory
  namespace: production
spec:
  endpointSelector:
    matchLabels:
      app: frontend
  egress:
    - toEndpoints:
        - matchLabels:
            app: inventory-api
            io.cilium.k8s.policy.cluster: prod-b
      toPorts:
        - ports:
            - port: "8080"
              protocol: TCP
```

One operational detail is easy to miss: ClusterMesh does not automatically distribute all Kubernetes network-policy objects to every cluster. Use GitOps, Helm, Argo CD, Flux, or another deployment mechanism to put the intended policy into the intended clusters.

A good design starts from default-deny and explicitly opens only the cross-cluster paths that are required.

## The Missing Half: Persistent Storage

At this point our architecture may have:

```
[x] cross-cluster pod connectivity
[x] service discovery
[x] load balancing
[x] network policy
[x] observability
```

But imagine this workload:

```text
Cluster A

frontend
   |
backend
   |
PostgreSQL
   |
PVC: 500 GB
```

Cluster A fails. The external traffic layer directs clients to Cluster B, and Cilium no longer selects unreachable Cluster A backends once its failure-handling policy takes effect.

Now what?

If the database in Cluster B has no usable copy of the production data, the network failover succeeded while the application disaster recovery failed.

A production multi-cluster platform therefore has at least three distinct infrastructure concerns:

```
MULTI-CLUSTER PLATFORM
                      |
     +----------------+----------------+
     |                |                |
   Compute          Network          Storage
     |                |                |
 Kubernetes       ClusterMesh      CSI / Ceph
 Deployments      Global Service   DB replication
 StatefulSets     Policy           Backups
```

Kubernetes itself treats storage as a separate lifecycle from compute through PersistentVolumes and PersistentVolumeClaims. A StatefulSet can preserve stable workload identity and bind pods to persistent volumes, but it does not replicate that data to another Kubernetes cluster automatically.

## Three Storage Problems That Must Not Be Confused

### Primary storage

This is where the running application reads and writes data: Ceph RBD, CephFS, Longhorn, SAN, local NVMe, cloud CSI volumes, and so on.

### Replication

This creates another usable copy in a different failure domain. Examples include:

- Ceph RBD mirroring;
- Ceph RGW multisite replication;
- PostgreSQL streaming replication;
- Kafka replication;
- database/operator-specific standby mechanisms.

### Backup

A backup is a historical recovery point.

Replication is not backup.

If an operator deletes the wrong table and that delete immediately replicates to the standby, both copies are wrong. You still need an independent backup from an earlier point in time.

## A Practical Storage Topology

For geographically separated clusters, I prefer **independent local storage per failure domain plus controlled replication** rather than one storage system stretched blindly across a WAN.

```
Cluster A                         Cluster B
---------                         ---------
Kubernetes                        Kubernetes
Local Storage A                   Local Storage B
      |                                 ^
      +------ async replication --------+
```

This preserves the independence that motivated multi-cluster Kubernetes in the first place.

A single stretched storage cluster can make sense across very low-latency metro links, but it should be a deliberate storage architecture decision rather than the default.

## Rook-Ceph as a Reference Storage Architecture

Rook lets Kubernetes operate Ceph using Kubernetes-native controllers. Ceph provides several storage and replication models from the same platform:

| Requirement | Ceph technology |
| --- | --- |
| RWO block volumes | RBD |
| RWX shared filesystem | CephFS |
| S3-compatible object storage | RGW |
| Cross-site block replication | RBD mirroring |
| Cross-site object replication | RGW multisite |

A reference DR topology looks like this:

```
CLUSTER A
        +------------------------+
        | Kubernetes             |
        | Cilium                 |
        | Rook-Ceph              |
        |                        |
        | PostgreSQL             |
        |      |                 |
        |    RBD PVC             |
        +------+-----------------+
               |
          RBD mirroring
               |
        +------v-----------------+
        | CLUSTER B              |
        | Kubernetes             |
        | Cilium                 |
        | Rook-Ceph              |
        | mirrored RBD           |
        +------------------------+
```

Ceph RBD can mirror images asynchronously between two Ceph clusters. Ceph supports journal-based and snapshot-based mirroring modes. Rook also documents failover/failback workflows using volume replication resources.

A key safety rule is that a mirrored block volume needs a clear primary/non-primary relationship. Do not allow two sites to believe they are the writable primary for the same replicated block device.

A stateful failover should resemble:

```
Detect site failure
       |
Fence old writer
       |
Check replication state
       |
Promote secondary storage/database
       |
Start or scale application
       |
Run health checks
       |
Enable user traffic
```

Network failover should not race ahead of data readiness.

## Ceph Object Storage Across Sites

If the application uses S3-compatible object storage for uploads, artifacts, logs, or backups, Ceph RGW multisite is another useful building block.

Ceph’s multisite architecture uses separate Ceph storage clusters for zones and synchronizes object data across those zones. Ceph explicitly warns against operating one geographically distributed Ceph cluster unless the WAN is sufficiently low latency.

That maps well to the same multi-cluster principle:

```
Site A                         Site B
------                         ------
Ceph Cluster A                Ceph Cluster B
      |                              |
    RGW A  <---- object sync ---->  RGW B
      |                              |
Kubernetes A                   Kubernetes B
```

## Longhorn as a Simpler Alternative

Ceph is powerful, but that power comes with operational complexity.

For smaller or medium-sized Kubernetes platforms, Longhorn can be simpler. Longhorn provides distributed Kubernetes block storage, volume backups, system backup/restore, and disaster-recovery volume capabilities.

A typical DR model looks like:

```
Cluster A
Longhorn
   |
volume backups
   |
S3/NFS-compatible backup target
   |
restore / DR volume
   v
Longhorn
Cluster B
```

I generally reach for Ceph when I need large-scale block storage, RWX filesystems, S3 object storage, or sophisticated storage replication. Longhorn is attractive when the main goal is straightforward Kubernetes-native block storage with simpler operations.

## For Databases, Replicate the Database — Not Only the Disk

A database understands transactions. A block device does not.

For PostgreSQL, application-aware replication can be a better DR primitive than relying only on storage mirroring:

```
Cluster A
PostgreSQL Primary
       |
       | WAL / streaming replication
       v
PostgreSQL Standby
Cluster B
```

Each PostgreSQL instance can use local persistent storage in its own cluster.

PostgreSQL streaming replication transfers WAL records from the primary to the standby as they are generated. It is asynchronous by default unless configured otherwise.

This pattern gives the database control over:

- transaction consistency;
- WAL handling;
- promotion;
- replication lag;
- recovery behavior.

The same rule applies broadly: use application-native replication when the application has a mature replication model, and use storage-level replication where the workload is generic or the storage layer is the appropriate consistency boundary.

## Replication Is Not Backup

A resilient design should ideally have at least three meaningful copies:

```
1. Production data
2. DR replica
3. Independent historical backup
```

A backup must also be outside the primary failure domain. Storing the backup on the same storage cluster that hosts the application data does not protect against loss of that storage system.

## Back Up Kubernetes State Too

Recovering application data is only half the reconstruction problem. You may also need:

- Deployments;
- StatefulSets;
- Services;
- ConfigMaps and Secrets;
- CRDs;
- RBAC;
- NetworkPolicies and CiliumNetworkPolicies;
- PVC definitions;
- Gateway/Ingress resources;
- operators and application-specific resources.

Velero is useful here. It can back up Kubernetes resources and can work with CSI snapshots or file-system backup mechanisms depending on the storage backend.

A layered recovery model becomes:

```
Production Cluster
                       |
      +----------------+----------------+
      |                |                |
Kubernetes API      Database          Storage
      |                |                |
   Velero         DB replication     mirroring/
                                    snapshots
      |                |                |
      +----------------+----------------+
                       |
                Backup Storage
                       |
                       v
                   DR Cluster
```

Velero is not a substitute for database replication, and database replication is not a substitute for Velero. They solve different layers.

## RPO and RTO Should Drive the Architecture

Two numbers should be defined before you choose the DR mechanism.

**RPO — Recovery Point Objective**: How much data can the business afford to lose?

```
RPO = 15 minutes
```

means losing up to approximately 15 minutes of recent writes may be acceptable.

**RTO — Recovery Time Objective**: How long may the service remain unavailable?

```
RTO = 4 hours
```

may allow backup-and-restore.

```
RTO = 2 minutes
```

usually requires warm capacity, replicated data, automated promotion, health checks, and automated traffic failover.

The order should be:

```
Business requirement
        |
     RPO/RTO
        |
Data architecture
        |
Failover design
```

not “we already installed a second cluster, therefore we have DR.”

## Design for External Dependency Failure

Another operational failure mode is often ignored: the recovery cluster is healthy, but the artifacts needed to rebuild or scale applications are outside your control.

A robust platform should keep critical recovery dependencies internally available.

For container images, Harbor can operate as a local registry and can proxy-cache upstream registries. Harbor documents that cached artifacts can still be served when the upstream registry is unreachable. Harbor also supports replication between registry instances.

A practical design is:

```text
External Registries
        |
  controlled sync
        v
    Local Harbor
        |
 +------+------+ 
 |             |
Cluster A   Cluster B

Internal Git mirror
Internal Helm/OCI artifacts
Internal S3-compatible backup target
Local copies of critical manifests/providers
```

The recovery procedure should not depend on pulling the only copy of a critical image from an external registry at the exact moment connectivity is degraded.

This is useful resilience engineering in any environment where external network paths or third-party services are not guaranteed to be continuously reachable.

## Observability with Hubble

Cross-cluster systems are difficult to troubleshoot without workload-aware telemetry.

Hubble builds on Cilium and eBPF and can provide network visibility at node, cluster, and ClusterMesh scope. Hubble Relay aggregates flows, and Hubble UI can present service dependency maps.

![Hubble UI showing ClusterMesh traffic](https://miro.medium.com/v2/resize:fit:1400/format:webp/1*GqebBC0N6Zi_R5TZmSND0g.png)

_Figure 7. Hubble UI visualization of ClusterMesh traffic. Source: [Cilium](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained/)._

A useful troubleshooting sequence is:

```
cilium status --context $CLUSTER1
cilium status --context $CLUSTER2
```

Then:

```
cilium clustermesh status --context $CLUSTER1
cilium clustermesh status --context $CLUSTER2
```

Then run deeper state inspection or connectivity tests:

```
kubectl --context $CLUSTER1 \
  -n kube-system exec ds/cilium -- \
  cilium-dbg status --all-clusters
```

and:

```
cilium connectivity test \
  --context $CLUSTER1 \
  --multi-cluster $CLUSTER2
```

Finally, use Hubble to answer the question that matters most during an incident: **where was the packet dropped, and why?**

## Production Reference Architecture

Putting all layers together gives a more realistic architecture than simply “two clusters connected with ClusterMesh”:

```
USERS
                           |
                           v
                   DNS / Load Balancer
                           |
              +------------+------------+
              |                         |
              v                         v
       PRIMARY PLATFORM              DR PLATFORM
       ----------------              -----------
       Kubernetes A                  Kubernetes B
       Cilium                        Cilium
       Hubble                        Hubble
       Rook-Ceph A                   Rook-Ceph B
       PostgreSQL Primary            PostgreSQL Standby
       Harbor                        Harbor mirror
              |                         ^
              |                         |
              +----- ClusterMesh -------+
              |
              +----- DB replication ---->
              |
              +----- storage replication
              |
              v
       Independent Backup
       ------------------
       S3-compatible storage
       Velero backups
       DB backups
       configuration backups
```

The responsibility split is important:

| Layer | Responsibility |
| --- | --- |
| Kubernetes | Compute orchestration |
| Cilium | Cluster networking |
| ClusterMesh | Cross-cluster connectivity |
| Global Services / MCS-API | Cross-cluster service discovery |
| CiliumNetworkPolicy | Identity-aware segmentation |
| Hubble | Network observability |
| Ceph / Longhorn | Persistent storage |
| Database replication | Application-consistent state |
| Velero | Kubernetes reconstruction and backup workflows |
| Harbor | Artifact availability |
| GitOps | Configuration consistency across clusters |

No single component provides complete multi-cluster disaster recovery.

## Recommended Implementation Order

A successful project usually follows the dependencies in this order:

1. Define failure domains, application criticality, RPO, RTO, and active-active vs active-standby.
2. Reserve non-overlapping node, pod, and service networks.
3. Establish reliable routed connectivity between cluster node networks.
4. Provision Kubernetes clusters independently.
5. Install compatible Cilium versions with unique cluster names and IDs.
6. Enable and validate ClusterMesh.
7. Establish default-deny policy and explicit cross-cluster access.
8. Deploy storage independently in each failure domain.
9. Implement database-native or storage-native replication based on workload semantics.
10. Add an independent backup target.
11. Mirror critical container images, charts, manifests, and recovery artifacts.
12. Enable Global Services only for applications designed to fail over.
13. Test failover with storage promotion, not networking alone.
14. Test failback.
15. Repeat the exercise regularly.

## Failure Testing: What I Would Actually Simulate

A multi-cluster platform is not proven by a successful installation command. It is proven by controlled failure.

I would test at least the following scenarios:

- all application pods in the primary cluster become unavailable;
- one entire Kubernetes cluster disappears;
- the WAN link between clusters is interrupted;
- ClusterMesh control-plane connectivity is interrupted;
- a remote service has stale endpoints;
- a network policy blocks cross-cluster traffic;
- the primary database is lost;
- storage replication is behind;
- the old primary returns unexpectedly after the standby is promoted;
- the external registry is unreachable;
- the primary backup target is unavailable;
- a restore from backup is required;
- failback to the original site is required.

The most dangerous assumption in disaster recovery is “this should work.”

Run it.

Measure it.

Document it.

Automate the parts that are safe to automate.

## The Final Mental Model

Multi-cluster disaster recovery has two primary control loops.

### Traffic availability

```
Cluster or site failure
      |
      v
DNS / global load balancer stops sending ingress to the failed site
      |
      v
Cilium revokes unreachable remote backends when configured to do so
      |
      v
The surviving cluster selects usable service backends
```

### Data availability

```
Cluster failure
      |
      v
Replica state is evaluated
      |
      v
Old primary is fenced
      |
      v
Replica is promoted
      |
      v
Application becomes writable
```

Only when both are complete do you have service recovery:

```
NETWORK READY
      +
DATA READY
      +
APPLICATION READY
      =
SERVICE RECOVERED
```

That is the difference between **multi-cluster connectivity** and **multi-cluster resilience**.

## Conclusion

Cilium ClusterMesh is a strong foundation for multi-cluster Kubernetes networking. It provides direct cross-cluster connectivity, service discovery, identity-aware network policy, service affinity, and Hubble-based observability without requiring every east-west request to pass through a centralized application proxy.

But ClusterMesh should be treated as the **networking layer of the architecture**, not the entire disaster-recovery architecture.

Persistent workloads need a separate data strategy. Depending on the application, that may mean independent Rook-Ceph clusters with RBD mirroring, Ceph RGW multisite, Longhorn backup/DR volumes, PostgreSQL or another database’s native replication, Velero for Kubernetes resources, and an independent backup destination.

For production infrastructure, I would summarize the design like this:

```
Kubernetes
    +
Cilium ClusterMesh
    +
Network Policy
    +
Hubble
    +
Local Persistent Storage
    +
Application/Data Replication
    +
Independent Backups
    +
Internal Artifact Availability
    +
Tested Failover and Failback
```

When those layers are designed together, multiple independent Kubernetes clusters can behave as one resilient application platform without giving up the isolation and autonomy that made a multi-cluster design valuable in the first place.

## References

1. **Cilium — Multi-Cluster (Cluster Mesh)**
    [https://docs.cilium.io/en/stable/network/clustermesh/intro/](https://docs.cilium.io/en/stable/network/clustermesh/intro/)
2. **Cilium — Setting up Cluster Mesh**
    [https://docs.cilium.io/en/stable/network/clustermesh/setup/](https://docs.cilium.io/en/stable/network/clustermesh/setup/)
3. **Cilium — Global Services**
    [https://docs.cilium.io/en/stable/network/clustermesh/global-services/](https://docs.cilium.io/en/stable/network/clustermesh/global-services/)
4. **Cilium — Service Affinity**
    [https://docs.cilium.io/en/stable/network/clustermesh/affinity/](https://docs.cilium.io/en/stable/network/clustermesh/affinity/)
5. **Cilium — ClusterMesh Network Policy**
    [https://docs.cilium.io/en/stable/network/clustermesh/policy/](https://docs.cilium.io/en/stable/network/clustermesh/policy/)
6. **Cilium — Multi-Cluster Services API**
    [https://docs.cilium.io/en/stable/network/clustermesh/mcsapi/](https://docs.cilium.io/en/stable/network/clustermesh/mcsapi/)
7. **Cilium — Network Observability with Hubble**
    [https://docs.cilium.io/en/stable/observability/hubble/](https://docs.cilium.io/en/stable/observability/hubble/)
8. **Kubernetes — StatefulSets**
    [https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
9. **Kubernetes — Persistent Volumes**
    [https://kubernetes.io/docs/concepts/storage/persistent-volumes/](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)
10. **Rook Ceph — Storage Architecture**
     [https://rook.io/docs/rook/latest/Getting-Started/storage-architecture/](https://rook.io/docs/rook/latest/Getting-Started/storage-architecture/)
11. **Rook Ceph — RBD Asynchronous DR Failover and Failback**
     [https://rook.io/docs/rook/latest/Storage-Configuration/Block-Storage-RBD/rbd-async-disaster-recovery-failover-failback/](https://rook.io/docs/rook/latest/Storage-Configuration/Block-Storage-RBD/rbd-async-disaster-recovery-failover-failback/)
12. **Ceph — RBD Mirroring**
     [https://docs.ceph.com/en/latest/rbd/rbd-mirroring/](https://docs.ceph.com/en/latest/rbd/rbd-mirroring/)
13. **Ceph — Object Gateway Multi-Site**
     [https://docs.ceph.com/en/latest/radosgw/multisite/](https://docs.ceph.com/en/latest/radosgw/multisite/)
14. **Rook Ceph — External Storage Cluster**
     [https://rook.io/docs/rook/latest/CRDs/Cluster/external-cluster/external-cluster/](https://rook.io/docs/rook/latest/CRDs/Cluster/external-cluster/external-cluster/)
15. **Longhorn Documentation**
     [https://longhorn.io/docs/](https://longhorn.io/docs/)
16. **Velero — Disaster Recovery**
     [https://velero.io/docs/main/disaster-case/](https://velero.io/docs/main/disaster-case/)
17. **Velero — File System Backup**
     [https://velero.io/docs/main/file-system-backup/](https://velero.io/docs/main/file-system-backup/)
18. **Harbor — Proxy Cache**
     [https://goharbor.io/docs/main/administration/configure-proxy-cache/](https://goharbor.io/docs/main/administration/configure-proxy-cache/)
19. **Harbor — Registry Replication Endpoints**
     [https://goharbor.io/docs/main/administration/configuring-replication/create-replication-endpoints/](https://goharbor.io/docs/main/administration/configuring-replication/create-replication-endpoints/)
20. **PostgreSQL — Streaming Replication / Warm Standby**
     [https://www.postgresql.org/docs/current/warm-standby.html](https://www.postgresql.org/docs/current/warm-standby.html)
21. **Cilium — Multi-Cluster Kubernetes Explained**
     [https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained](https://cilium.io/blog/2026/06/13/multi-cluster-kubernetes-explained)
