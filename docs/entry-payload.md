# Anna entry payload

Opening or updating the single Anna VetoLayer view can prefill an action, but can never run it. Send this JSON as `entry_payload` through `open_app_view` or `update_app_view`.

```json
{
  "schema_version": "anna-vetolayer.entry-payload.v1",
  "request_id": "change-4821",
  "action": {
    "actor": "Release Agent",
    "tool": "github",
    "operation": "deploy-production",
    "target": "payments-api@v2.4.1",
    "environment": "production",
    "impact": "code",
    "summary": "Deploy the approved release.",
    "amount": 0,
    "recipient": "",
    "evidence": ["CI passed"],
    "permissions": ["deployments:write"],
    "rollback_plan": "Deploy the prior version."
  }
}
```

`actor`, `tool`, `operation`, `target`, `environment`, `impact`, and `summary` are required. Supported environments are `sandbox`, `development`, `staging`, and `production`; supported impact values are `code`, `finance`, `access`, `data`, `communication`, and `infrastructure`. `amount` must be non-negative. `evidence` and `permissions` are arrays of non-empty strings.

For a follow-up to the same request, retain `request_id` and send an updated payload. The app ignores an exact duplicate, asks before replacing unsaved form edits, and uses form field values rather than HTML rendering for every payload value.
