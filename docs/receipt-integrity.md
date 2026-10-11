# Receipt integrity and lineage

Receipts using `anna-vetolayer.integrity.v1` carry a SHA-256 integrity digest over canonical JSON with their `integrity` object and operational `persistence` flag excluded. Object keys are sorted recursively; arrays retain order. This lets the browser and Policy Engine recompute the same digest for identical receipt data.

The app reports each receipt as `valid`, `invalid`, or `unverifiable`. Older receipts without the versioned format are legacy and unverifiable, never treated as valid. A parent receipt reference is checked separately: missing parents and cycles are reported as broken lineage.

The digest is an integrity check, not a cryptographic signature or identity assertion. JSON exports include both the integrity result and the compact lineage result at the time of export.
