import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import type { CommandContext } from "@caido/sdk-frontend";

import { getState, setState } from "./state";
import { loadProject, loadTags, loadTaggedRequests } from "./api";
import { initRegistry } from "./registry";
import { createTaggedRequestsPage } from "./pages/TaggedRequests";
import { createTagConfigPage } from "./pages/TagConfig";
import { createTaggingModal } from "./components/TaggingModal";

import "./styles/style.css";

type SDK = Caido<API>;

const Page = "/caido-tagger" as const;
const Commands = {
  tagRequest: "caido-tagger.tag-request",
} as const;

// --- Page builder ---

function buildPage(sdk: SDK): HTMLElement {
  const root = document.createElement("div");
  root.className = "ct-root";

  // Tab bar
  const tabBar = document.createElement("div");
  tabBar.className = "ct-tabbar";

  const tabTagged = document.createElement("button");
  tabTagged.className = "ct-tab ct-tab--active";
  tabTagged.textContent = "Tagged Requests";

  const tabConfig = document.createElement("button");
  tabConfig.className = "ct-tab";
  tabConfig.textContent = "Tag Config";

  tabBar.appendChild(tabTagged);
  tabBar.appendChild(tabConfig);

  // Content area — swapped on tab change
  const content = document.createElement("div");
  content.className = "ct-content";

  let currentPage: HTMLElement | null = null;

  const showTab = (tab: "tagged-requests" | "tag-config") => {
    setState(() => ({ activeTab: tab }));

    tabTagged.classList.toggle("ct-tab--active", tab === "tagged-requests");
    tabConfig.classList.toggle("ct-tab--active", tab === "tag-config");

    // Destroy previous page
    if (currentPage) {
      currentPage.dispatchEvent(new Event("ct:destroy"));
      content.innerHTML = "";
    }

    if (tab === "tagged-requests") {
      currentPage = createTaggedRequestsPage(sdk);
    } else {
      currentPage = createTagConfigPage(sdk);
    }

    content.appendChild(currentPage);
  };

  tabTagged.addEventListener("click", () => showTab("tagged-requests"));
  tabConfig.addEventListener("click", () => showTab("tag-config"));

  root.appendChild(tabBar);
  root.appendChild(content);

  // Initialize with default tab
  showTab("tagged-requests");

  return root;
}

// --- Init ---

export const init = async (sdk: SDK) => {
  // Expose global plugin registry for other plugins
  initRegistry();

  // Load project context
  await loadProject(sdk);

  const { projectId } = getState();

  if (projectId) {
    await Promise.all([
      loadTags(sdk, projectId),
      loadTaggedRequests(sdk, projectId),
    ]);
  }

  // Register plugin page
  const body = buildPage(sdk);
  sdk.navigation.addPage(Page, { body });

  // Register sidebar entry
  sdk.sidebar.registerItem("Tagger", Page, {
    icon: "fas fa-tags",
  });

  // Register "Tag Request" command (triggers from HTTP History right-click)
  sdk.commands.register(Commands.tagRequest, {
    name: "Tag Request",
    group: "caido-tagger",
    run: (context: CommandContext) => {
      if (context.type !== "RequestRowContext") return;

      const { projectId } = getState();
      if (!projectId) {
        sdk.window.showToast("No active project found.", { variant: "error" });
        return;
      }

      const requestIds = context.requests.map((r) => r.id);

      const modal = createTaggingModal({
        sdk,
        requestIds,
        projectId,
        onDone: () => {
          loadTaggedRequests(sdk, projectId);
        },
      });

      document.body.appendChild(modal);
    },
    when: (context: CommandContext) => context.type === "RequestRowContext",
  });

  // Register context menu entry in HTTP History
  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: Commands.tagRequest,
    leadingIcon: "fas fa-tags",
  });

  sdk.console.log("caido-tagger frontend initialized");
};
