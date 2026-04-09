// Collections Bridge
//
// TODO: Verify if Caido's backend SDK exposes a Collections API.
// From the SDK type inspection, collections are not present in the backend SDK.
// This feature may need to be implemented from the frontend side.
//
// Current workaround: The frontend will handle Collection sync via sdk.collections
// after verifying frontend SDK capabilities.
//
// Placeholder functions are kept here for interface consistency.

import { SDK } from "caido:plugin";

export async function syncRequestToCollection(
  _sdk: SDK,
  _collectionName: string,
  _requestId: string
): Promise<void> {
  // TODO: Implement once Collections API is confirmed available
}

export async function removeRequestFromCollection(
  _sdk: SDK,
  _collectionName: string,
  _requestId: string
): Promise<void> {
  // TODO: Implement once Collections API is confirmed available
}
