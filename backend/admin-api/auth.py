from __future__ import annotations

ROLE_PERMISSIONS = {
    "citizen": {"chat:query"},
    "staff": {"chat:query", "documents:list", "audit:view"},
    "document_admin": {"chat:query", "documents:list", "documents:write", "audit:view"},
    "system_admin": {"chat:query", "documents:list", "documents:write", "audit:view", "users:write", "users:read"},
    "readonly_auditor": {"audit:view", "users:read"},
}
