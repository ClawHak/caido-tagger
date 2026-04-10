import type { Caido } from "@caido/sdk-frontend";
import type { API } from "caido-tagger-backend";
import type { CommandContext } from "@caido/sdk-frontend";

import { getState, setState } from "./state";
import { loadProject, loadTags, loadTaggedRequests, refreshAll, sendToReplay, sendToAutomate } from "./api";

import { initRegistry } from "./registry";
import { createTaggedRequestsPage } from "./pages/TaggedRequests";
import { createTagConfigPage } from "./pages/TagConfig";
import { createTaggingModal } from "./components/TaggingModal";

import "./styles/style.css";

type SDK = Caido<API>;

const Page = "/caido-tagger" as const;
const Commands = {
  tagRequest: "caido-tagger.tag-request",
  sendToReplay: "caido-tagger.send-to-replay",
  sendToAutomate: "caido-tagger.send-to-automate",
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

    // Refresh project + data on every tab switch (state updates trigger re-renders via subscriptions)
    refreshAll(sdk, tab === "tagged-requests");
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

  // Load initial project context
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

  // Send to Replay
  sdk.commands.register(Commands.sendToReplay, {
    name: "Send to Replay",
    group: "caido-tagger",
    run: async (context: CommandContext) => {
      if (context.type !== "RequestRowContext") return;
      for (const r of context.requests) {
        await sendToReplay(sdk, r.id);
      }
    },
    when: (context: CommandContext) => context.type === "RequestRowContext",
  });

  // Send to Automate
  sdk.commands.register(Commands.sendToAutomate, {
    name: "Send to Automate",
    group: "caido-tagger",
    run: async (context: CommandContext) => {
      if (context.type !== "RequestRowContext") return;
      for (const r of context.requests) {
        await sendToAutomate(sdk, r.id);
      }
    },
    when: (context: CommandContext) => context.type === "RequestRowContext",
  });

  // Register context menu entries in HTTP History
  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: Commands.tagRequest,
    leadingIcon: "fas fa-tags",
  });

  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: Commands.sendToReplay,
    leadingIcon: "fas fa-play",
  });

  sdk.menu.registerItem({
    type: "RequestRow",
    commandId: Commands.sendToAutomate,
    leadingIcon: "fas fa-robot",
  });

  // React to project switches in the Caido UI
  try {
    (sdk as any).projects.onCurrentProjectChange(() => {
      refreshAll(sdk, true);
    });
  } catch {
    // sdk.projects not available in this Caido version — ignore
  }

  sdk.console.log("caido-tagger frontend initialized");
};
