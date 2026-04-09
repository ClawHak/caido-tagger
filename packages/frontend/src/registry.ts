// Plugin Action Registry
//
// Allows other Caido plugins to register actions that appear in the
// "Plugin Actions" dropdown on the Tagged Requests page.
//
// Usage from another plugin (e.g. caido-nuclei):
//
//   window.__caidoTagger?.registerAction({
//     id: "nuclei-xss",
//     label: "Send to Nuclei XSS",
//     handler: (requestIds) => { ... }
//   });
//
// Actions are automatically shown in the bulk action bar when
// at least one request is selected on the Tagged Requests page.

export type TaggerAction = {
  /** Unique identifier for the action */
  id: string;
  /** Label shown in the Plugin Actions dropdown */
  label: string;
  /** Called with the selected request IDs when the action is triggered */
  handler: (requestIds: string[]) => void | Promise<void>;
};

export type CaidoTaggerRegistry = {
  version: "1.0";
  registerAction: (action: TaggerAction) => void;
  unregisterAction: (id: string) => void;
  getActions: () => TaggerAction[];
};

declare global {
  interface Window {
    __caidoTagger?: CaidoTaggerRegistry;
  }
}

const actions = new Map<string, TaggerAction>();
const changeListeners = new Set<() => void>();

export function initRegistry(): void {
  window.__caidoTagger = {
    version: "1.0",

    registerAction(action: TaggerAction): void {
      actions.set(action.id, action);
      changeListeners.forEach((fn) => fn());
    },

    unregisterAction(id: string): void {
      actions.delete(id);
      changeListeners.forEach((fn) => fn());
    },

    getActions(): TaggerAction[] {
      return [...actions.values()];
    },
  };
}

export function getRegisteredActions(): TaggerAction[] {
  return [...actions.values()];
}

export function onRegistryChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}
