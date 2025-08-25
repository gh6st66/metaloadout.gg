
- Validate delta against v0.4 schemas and tags_registry.
- Upsert by id. Union+dedup tags and notes. Preserve existing non-null class/status on conflict; log.
- meta.weapon_tiers: curated only, never changed by ingest.
- Append _provenance entry; bump PATCH; set updated_at.
- Deprecation: set deprecated:true and replaced_by, do not delete.
