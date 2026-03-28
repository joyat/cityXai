/**
 * cityXai Citizen Widget
 *
 * Embed on any municipal website:
 *   <script
 *     src="https://cityxai.local/widget.js"
 *     data-namespace="paderborn"
 *     data-api-base=""
 *     data-title="Bürgerchat"
 *   ></script>
 *
 * Config via data attributes on the script tag OR window.cityXaiConfig:
 *   namespace   — municipality slug (required)
 *   apiBase     — base URL if widget is served cross-origin (default: same origin)
 *   title       — launcher button label (default: "Bürgerchat")
 */
(function () {
  // Resolve config from script tag data-attributes, then window.cityXaiConfig, then defaults
  const scriptTag = document.currentScript || (function () {
    const tags = document.getElementsByTagName("script");
    return tags[tags.length - 1];
  })();
  const cfg = window.cityXaiConfig || {};
  const apiBase = scriptTag.getAttribute("data-api-base") || cfg.apiBaseUrl || "";
  const namespace = scriptTag.getAttribute("data-namespace") || cfg.namespace || "public";
  const widgetTitle = scriptTag.getAttribute("data-title") || cfg.title || "Bürgerchat";

  const styles = `
    .cityxai-launcher{position:fixed;right:20px;bottom:20px;background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff;border:none;border-radius:999px;padding:14px 20px;z-index:9999;cursor:pointer;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,212,255,0.4);transition:transform .15s,box-shadow .15s}
    .cityxai-launcher:hover{transform:translateY(-2px);box-shadow:0 6px 28px rgba(0,212,255,0.55)}
    .cityxai-panel{position:fixed;right:20px;bottom:80px;width:min(380px,92vw);height:560px;background:#0f1535;border:1px solid rgba(0,212,255,0.2);border-radius:18px;box-shadow:0 16px 48px rgba(0,0,0,.5);display:none;flex-direction:column;z-index:9999;overflow:hidden}
    .cityxai-header{padding:14px 16px;background:linear-gradient(135deg,rgba(0,212,255,0.15),rgba(124,58,237,0.12));border-bottom:1px solid rgba(255,255,255,0.07)}
    .cityxai-header strong{color:#fff;font-size:15px}
    .cityxai-body{flex:1;overflow:auto;padding:12px;display:flex;flex-direction:column;gap:10px}
    .cityxai-row{padding:10px 12px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.07);color:#e2e8f5;font-size:13px;line-height:1.6}
    .cityxai-row.user{background:rgba(0,212,255,0.08);border-color:rgba(0,212,255,0.2)}
    .cityxai-row strong{display:block;font-size:11px;font-weight:600;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
    .cityxai-row ol{margin:8px 0 0 16px;color:rgba(255,255,255,0.5);font-size:11px}
    .cityxai-note{font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px}
    .cityxai-footer{padding:12px;border-top:1px solid rgba(255,255,255,0.07)}
    .cityxai-footer textarea{width:100%;min-height:72px;border-radius:10px;border:1px solid rgba(255,255,255,0.12);padding:10px;background:rgba(255,255,255,0.05);color:#e2e8f5;font-size:13px;resize:none;outline:none;box-sizing:border-box}
    .cityxai-footer textarea:focus{border-color:rgba(0,212,255,0.5);box-shadow:0 0 0 3px rgba(0,212,255,0.1)}
    .cityxai-footer button{margin-top:8px;width:100%;padding:10px;border:none;border-radius:10px;background:linear-gradient(135deg,#00d4ff,#7c3aed);color:#fff;font-size:13px;font-weight:600;cursor:pointer}
    .cityxai-thinking{color:rgba(255,255,255,0.35);font-style:italic;font-size:12px;padding:8px 12px}
    .cityxai-error{color:#ef4444;font-size:12px;padding:6px 12px}
  `;
  const styleTag = document.createElement("style");
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);

  const launcher = document.createElement("button");
  launcher.className = "cityxai-launcher";
  launcher.setAttribute("aria-label", widgetTitle + " öffnen");
  launcher.textContent = widgetTitle;

  const panel = document.createElement("section");
  panel.className = "cityxai-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "cityXai " + widgetTitle);
  panel.innerHTML = `
    <div class="cityxai-header">
      <strong>⚡ cityXai</strong>
      <div class="cityxai-note">Nach KI-Verordnung Art. 13: Diese Antworten sind automatisiert generiert.</div>
    </div>
    <div class="cityxai-body" tabindex="0"></div>
    <div class="cityxai-footer">
      <label aria-label="Frage eingeben" style="display:block">
        <textarea placeholder="Stellen Sie Ihre Frage an die Stadtverwaltung…"></textarea>
      </label>
      <button aria-label="Frage absenden">Senden</button>
    </div>
  `;

  const body = panel.querySelector(".cityxai-body");
  const textarea = panel.querySelector("textarea");
  const sendBtn = panel.querySelector("button");

  function append(role, text, sources) {
    const row = document.createElement("div");
    row.className = "cityxai-row" + (role === "user" ? " user" : "");
    const label = role === "user" ? "Sie" : "cityXai";
    row.innerHTML = `<strong>${label}</strong><div>${text.replace(/\n/g, "<br>")}</div>`;
    if (sources && sources.length) {
      const ol = document.createElement("ol");
      sources.forEach(function (src) {
        const li = document.createElement("li");
        li.textContent = src.filename + (src.section_heading ? " · " + src.section_heading : "");
        ol.appendChild(li);
      });
      row.appendChild(ol);
    }
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
    return row;
  }

  function appendThinking() {
    const el = document.createElement("div");
    el.className = "cityxai-thinking";
    el.textContent = "Analysiere…";
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
    return el;
  }

  // Obtain a citizen token via the dev-login endpoint (falls back gracefully when Keycloak is up)
  async function ensureCitizenToken() {
    const cached = window.sessionStorage.getItem("cityxai_citizen_token");
    if (cached) {
      // Check expiry
      try {
        const payload = JSON.parse(atob(cached.split(".")[1]));
        if (payload.exp && payload.exp > Math.floor(Date.now() / 1000) + 30) return cached;
      } catch (_) {}
    }
    window.sessionStorage.removeItem("cityxai_citizen_token");

    // Try Keycloak first
    try {
      const params = new URLSearchParams({
        client_id: "cityxai-frontend",
        grant_type: "password",
        username: "citizen@demo.de",
        password: window.cityXaiConfig?.citizenPassword || "Demo1234!"
      });
      const r = await fetch(apiBase + "/keycloak/realms/cityxai/protocol/openid-connect/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      });
      const d = await r.json();
      if (d.access_token) {
        window.sessionStorage.setItem("cityxai_citizen_token", d.access_token);
        return d.access_token;
      }
    } catch (_) {}

    // Fallback to dev-login
    const r2 = await fetch(apiBase + "/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "citizen@demo.de", password: window.cityXaiConfig?.citizenPassword || "Demo1234!" })
    });
    const d2 = await r2.json();
    if (d2.access_token) {
      window.sessionStorage.setItem("cityxai_citizen_token", d2.access_token);
      return d2.access_token;
    }
    throw new Error("Anmeldung fehlgeschlagen");
  }

  const history = [];

  async function submit() {
    const query = textarea.value.trim();
    if (!query) return;
    append("user", query);
    history.push({ role: "user", content: query });
    textarea.value = "";
    sendBtn.disabled = true;
    const thinking = appendThinking();

    try {
      const token = await ensureCitizenToken();
      const response = await fetch(apiBase + "/api/chat/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token,
          "X-Namespace": namespace
        },
        body: JSON.stringify({ query: query, namespace: namespace, conversation_history: history })
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      const data = await response.json();
      thinking.remove();
      const disclaimer = "\n\nFür verbindliche Auskünfte wenden Sie sich bitte an die Stadtverwaltung.";
      append("assistant", (data.answer || "Keine Antwort erhalten.") + disclaimer, data.sources || []);
      history.push({ role: "assistant", content: data.answer || "" });
    } catch (err) {
      thinking.remove();
      const errEl = document.createElement("div");
      errEl.className = "cityxai-error";
      errEl.textContent = "Fehler: " + (err.message || "Verbindung fehlgeschlagen.");
      body.appendChild(errEl);
    } finally {
      sendBtn.disabled = false;
      textarea.focus();
    }
  }

  launcher.addEventListener("click", function () {
    const isOpen = panel.style.display === "flex";
    panel.style.display = isOpen ? "none" : "flex";
    if (!isOpen) textarea.focus();
  });
  sendBtn.addEventListener("click", submit);
  textarea.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  });

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
})();
