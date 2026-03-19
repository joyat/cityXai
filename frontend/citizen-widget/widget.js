(function () {
  const apiBase = window.PadeRoBotConfig?.apiBaseUrl || "";
  const namespace = "public";
  const styles = `
    .paderobot-launcher{position:fixed;right:20px;bottom:20px;background:#005b96;color:#fff;border:none;border-radius:999px;padding:14px 18px;z-index:9999}
    .paderobot-panel{position:fixed;right:20px;bottom:80px;width:min(380px,92vw);height:560px;background:#fff;border:1px solid #cfd7df;border-radius:18px;box-shadow:0 12px 30px rgba(0,0,0,.2);display:none;flex-direction:column;z-index:9999}
    .paderobot-header{padding:14px 16px;background:#10293d;color:#fff;border-radius:18px 18px 0 0}
    .paderobot-body{flex:1;overflow:auto;padding:12px;background:#f6f8fa}
    .paderobot-row{margin-bottom:10px;padding:10px;border-radius:12px;background:#fff}
    .paderobot-row.user{background:#dff1ff}
    .paderobot-footer{padding:12px;border-top:1px solid #d9e1e7}
    .paderobot-footer textarea{width:100%;min-height:82px;border-radius:12px;border:1px solid #cfd7df;padding:10px}
    .paderobot-footer button{margin-top:8px;width:100%;padding:10px;border:none;border-radius:12px;background:#005b96;color:#fff}
    .paderobot-note{font-size:12px;color:#495865}
  `;
  const styleTag = document.createElement("style");
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);

  const launcher = document.createElement("button");
  launcher.className = "paderobot-launcher";
  launcher.setAttribute("aria-label", "PadeRoBot Chat öffnen");
  launcher.textContent = "Bürgerchat";

  const panel = document.createElement("section");
  panel.className = "paderobot-panel";
  panel.setAttribute("aria-label", "PadeRoBot Bürgerchat");
  panel.innerHTML = `
    <div class="paderobot-header"><strong>PadeRoBot+</strong><div class="paderobot-note">Hinweis nach KI-Verordnung: Dieses System erzeugt Antworten automatisiert.</div></div>
    <div class="paderobot-body" tabindex="0"></div>
    <div class="paderobot-footer">
      <label aria-label="Frage eingeben">
        <textarea></textarea>
      </label>
      <button aria-label="Frage absenden">Senden</button>
    </div>
  `;

  const body = panel.querySelector(".paderobot-body");
  const textarea = panel.querySelector("textarea");
  const send = panel.querySelector("button");

  function append(role, text, sources) {
    const row = document.createElement("div");
    row.className = "paderobot-row" + (role === "user" ? " user" : "");
    row.innerHTML = `<strong>${role === "user" ? "Sie" : "PadeRoBot+"}</strong><div>${text}</div>`;
    if (sources && sources.length) {
      const ol = document.createElement("ol");
      sources.forEach((source) => {
        const li = document.createElement("li");
        li.textContent = `${source.filename} (${source.section_heading || "Abschnitt"})`;
        ol.appendChild(li);
      });
      row.appendChild(ol);
    }
    body.appendChild(row);
    body.scrollTop = body.scrollHeight;
  }

  async function ensureCitizenToken() {
    if (window.sessionStorage.getItem("paderobot_citizen_token")) return window.sessionStorage.getItem("paderobot_citizen_token");
    const params = new URLSearchParams();
    params.set("client_id", "paderobot-frontend");
    params.set("grant_type", "password");
    params.set("username", "citizen@demo.de");
    params.set("password", "Demo1234!");
    const response = await fetch(`${apiBase}/keycloak/realms/paderobot/protocol/openid-connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const data = await response.json();
    window.sessionStorage.setItem("paderobot_citizen_token", data.access_token);
    return data.access_token;
  }

  async function submit() {
    const query = textarea.value.trim();
    if (!query) return;
    append("user", query);
    textarea.value = "";
    const token = await ensureCitizenToken();
    const response = await fetch(`${apiBase}/api/chat/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "X-Namespace": "paderborn"
      },
      body: JSON.stringify({ query, namespace, conversation_history: [] })
    });
    const data = await response.json();
    append("assistant", `${data.answer}\n\nDiese Antwort ist automatisch generiert. Für verbindliche Auskünfte wenden Sie sich bitte an uns.`, data.sources || []);
  }

  launcher.addEventListener("click", function () {
    panel.style.display = panel.style.display === "flex" ? "none" : "flex";
    textarea.focus();
  });
  send.addEventListener("click", submit);
  textarea.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });

  document.body.appendChild(launcher);
  document.body.appendChild(panel);
})();
