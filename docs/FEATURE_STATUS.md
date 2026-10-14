# Anvil Studio — implementation status

Anvil is currently a **self-hosted Windows + private Wi-Fi application**, not a hosted multi-tenant SaaS platform. The new Studio workspace runs in each browser, and data is saved in that browser's local storage. The GitHub Pages site is a product/download page, not a hosted user account or cloud database.

## Implemented in the private Wi-Fi web app

| Feature | Status | Implementation |
|---|---|---|
| Mobile-first chat | Implemented, browser smoke tests | Insecure-HTTP-safe conversation IDs, mobile composer and navigation, stream/buffer fallback |
| Thinking control | Removed | Chat no longer sends unsupported reasoning parameters |
| Optional Auto Refine | Implemented | Local draft-review-revise loop with bounded attempts; confidence is **not** calibrated factual accuracy |
| Dashboard personalization | Local | Toggle three dashboard widgets; change theme |
| Presentation generator/editor | Local | Three-slide structured template generator; edit titles/bodies, add/remove slides, export HTML |
| Data import | Local | CSV / TSV / JSON parser; 2,000 row preview limit |
| Interactive charts | Local | Bar / line / donut, hover/select feedback; HTML export of tabular data |
| Diagram editor | Local | Create/edit/delete/reorder process steps and export |
| Report builder | Local | Charts, source table, record summary, HTML export |
| Visualization gallery | Local | Four starter presentation themes |
| Project search | Local | Search project names; local autosave |
| Versions | Local | Manual project snapshots and restore, capped to 12 |
| Sharing/collaboration | Manual | Export JSON from editor, import into another browser. Not simultaneous multi-user editing |
| Plugin controls | Declarative demo | Toggle built-in workspace tools; register user-created metadata manifests without executing code |
| Account/profile page | Local profile only | Editable display name and theme. No registered accounts or backend authentication |
| Notifications | Local activity | Project creation/version activity history |
| Email | Mailto draft only | Opens the device's mail client; no inbox connection, send/receive, or account credentials |
| Dashboard widget system | Local | Enable/disable built-in widgets |
| Security | LAN scope | Optional Wi-Fi access code and origin/host validation. HTTP on Wi-Fi is not TLS encrypted |
| Accessibility | Basic foundation | Semantic labels, focus rings, keyboard-accessible editing, responsive CSS. Not a certified WCAG audit |

## Not yet implemented — production backend required

- Secure cloud account creation, verification, profile pictures, password recovery, MFA, organization and role-based permissions
- Real-time collaboration with presence, conflict resolution, audit trails, shared cloud documents, and synchronization across devices
- Executable third-party plugin API, marketplace distribution, review, sandboxing, developer SDK, plugin permissions and shared ownership
- Excel/XLSX parsing and live integrations for Google Analytics, AWS, Tableau, Power BI, Google Drive and other external data providers
- OAuth-authorized inbox read/send functionality, provider scopes, email synchronization and personalized notifications
- Community discussion forum and moderation, repository-backed versioning and integrated debugging/testing runner
- High availability, observability, deployment at scale, secure backup, encryption/key management and penetration testing

## Suggested technical roadmap

1. **Reliability & accessibility:** test iOS Safari and Android Chrome with real devices; optimize the visual editor, add keyboard testing and accessibility audits.
2. **Authentication & shared storage:** HTTPS, secure sessions, organization/workspace model, PostgreSQL, object storage, audit logs, per-project ACLs.
3. **Collaboration:** websocket synchronization with CRDT/OT or equivalent, snapshots, offline reconciliation, concurrent-edit tests.
4. **Integration/plugin SDK:** sandboxed iframe or isolate execution, capability/permission model, signed manifests, developer publishing and review process.
5. **External connectors:** OAuth token vault, rate limits, retries, provider SDKs, XLSX parsing via a maintained vetted library and scheduled import.
6. **Email, community & production:** provider-specific permissions, moderation, observability, backup/restore, security audit and real-world load testing.

Do **not** describe these future backend features as functioning in the current Anvil installer. The local demos are deliberately isolated from third-party accounts and code execution.
