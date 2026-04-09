import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import type { ActiveTab } from "./types";

import "./styles/style.css";

type CaidoSDK = Caido<API>;

const Page = "/caido-tagger" as const;

// --- Tab state ---

let activeTab: ActiveTab = "tagged-requests";

// --- Page builder ---

function buildPage(sdk: CaidoSDK): HTMLElement {
  const root = document.createElement("div");
  root.className = "ct-root";

  // Tab bar
  const tabBar = document.createElement("div");
  tabBar.className = "ct-tabbar";

  const tabTagged = document.createElement("button");
  tabTagged.className = "ct-tab ct-tab--active";
  tabTagged.textContent = "Tagged Requests";
  tabTagged.dataset["tab"] = "tagged-requests";

  const tabConfig = document.createElement("button");
  tabConfig.className = "ct-tab";
  tabConfig.textContent = "Tag Config";
  tabConfig.dataset["tab"] = "tag-config";

  tabBar.appendChild(tabTagged);
  tabBar.appendChild(tabConfig);

  // Tab content area
  const content = document.createElement("div");
  content.className = "ct-content";
  content.innerHTML = renderTaggedRequests();

  // Tab switching
  [tabTagged, tabConfig].forEach((btn) => {
    btn.addEventListener("click", () => {
      activeTab = btn.dataset["tab"] as ActiveTab;

      tabTagged.classList.toggle("ct-tab--active", activeTab === "tagged-requests");
      tabConfig.classList.toggle("ct-tab--active", activeTab === "tag-config");

      if (activeTab === "tagged-requests") {
        content.innerHTML = renderTaggedRequests();
      } else {
        content.innerHTML = renderTagConfig();
      }
    });
  });

  root.appendChild(tabBar);
  root.appendChild(content);

  return root;
}

// --- Tab: Tagged Requests (placeholder) ---

function renderTaggedRequests(): string {
  return `
    <div class="ct-placeholder">
      <p>No tagged requests yet.</p>
      <p>Right-click any request in HTTP History and select <strong>Tag Request</strong> to get started.</p>
    </div>
  `;
}

// --- Tab: Tag Config (placeholder) ---

function renderTagConfig(): string {
  return `
    <div class="ct-placeholder">
      <p>Tag configuration coming in Phase 2.</p>
    </div>
  `;
}

// --- Init ---

export const init = async (sdk: CaidoSDK) => {
  // Verify backend connection
  const status = await sdk.backend.ping();
  sdk.console.log(`caido-tagger: ${status}`);

  // Register plugin page
  const body = buildPage(sdk);
  sdk.navigation.addPage(Page, { body });

  // Register sidebar entry
  sdk.sidebar.registerItem("Tagger", Page, {
    icon: "fas fa-tags",
  });

  sdk.console.log("caido-tagger frontend initialized");
};
