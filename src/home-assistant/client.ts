type HomeAssistantState = {
  entity_id: string;
  state: string;
  last_updated: string;
  attributes: {
    friendly_name?: string;
    latitude?: number;
    longitude?: number;
    source?: string;
    [key: string]: unknown;
  };
};

export type DiscoverableEntity = {
  entityId: string;
  friendlyName: string;
  domain: string;
  hasCoordinates: boolean;
  locationSummary?: string;
};

export type LocationSnapshot = {
  entityId: string;
  friendlyName: string;
  state: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  locationSummary?: string;
};

function getEntityDomain(entityId: string) {
  const [domain] = entityId.split(".");
  return domain ?? "unknown";
}

function getEntityObjectId(entityId: string) {
  const [, objectId] = entityId.split(".");
  return objectId ?? entityId;
}

function isUsefulLocationText(state: string) {
  return !["unknown", "unavailable", "none", "not_set"].includes(state.toLowerCase());
}

function buildGeocodedSensorCandidates(state: HomeAssistantState) {
  const candidates = new Set<string>();
  const objectId = getEntityObjectId(state.entity_id);
  candidates.add(`sensor.${objectId}_geocoded_location`);

  if (typeof state.attributes.source === "string") {
    const sourceObjectId = getEntityObjectId(state.attributes.source);
    candidates.add(`sensor.${sourceObjectId}_geocoded_location`);
  }

  return [...candidates];
}

function resolveLocationSummary(state: HomeAssistantState, stateMap: Map<string, HomeAssistantState>) {
  for (const candidate of buildGeocodedSensorCandidates(state)) {
    const geocodedState = stateMap.get(candidate);
    if (geocodedState && isUsefulLocationText(geocodedState.state)) {
      return geocodedState.state;
    }
  }

  if (isUsefulLocationText(state.state) && !["home", "not_home"].includes(state.state.toLowerCase())) {
    return state.state;
  }

  return undefined;
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.trim().replace(/\/+$/, "");
}

async function fetchJson<T>(baseUrl: string, token: string, path: string): Promise<T> {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Home Assistant request failed (${response.status}): ${body || response.statusText}`);
  }

  return (await response.json()) as T;
}

export async function validateHomeAssistantConnection(baseUrl: string, token: string) {
  await fetchJson<Record<string, unknown>>(baseUrl, token, "/api/");
}

export async function listDiscoverableEntities(baseUrl: string, token: string) {
  const states = await fetchJson<HomeAssistantState[]>(baseUrl, token, "/api/states");
  const stateMap = new Map(states.map((state) => [state.entity_id, state]));

  return states
    .filter((state) => {
      const domain = getEntityDomain(state.entity_id);
      return domain === "person" || domain === "device_tracker";
    })
    .map<DiscoverableEntity>((state) => {
      return {
        entityId: state.entity_id,
        friendlyName: state.attributes.friendly_name ?? state.entity_id,
        domain: getEntityDomain(state.entity_id),
        hasCoordinates:
          typeof state.attributes.latitude === "number" && typeof state.attributes.longitude === "number",
        locationSummary: resolveLocationSummary(state, stateMap),
      };
    })
    .sort((left, right) => left.friendlyName.localeCompare(right.friendlyName));
}

export async function getLocationSnapshot(baseUrl: string, token: string, entityId: string): Promise<LocationSnapshot> {
  const [state, allStates] = await Promise.all([
    fetchJson<HomeAssistantState>(baseUrl, token, `/api/states/${encodeURIComponent(entityId)}`),
    fetchJson<HomeAssistantState[]>(baseUrl, token, "/api/states"),
  ]);

  if (typeof state.attributes.latitude !== "number" || typeof state.attributes.longitude !== "number") {
    throw new Error(`${entityId} does not currently expose latitude and longitude`);
  }

  const stateMap = new Map(allStates.map((entry) => [entry.entity_id, entry]));

  return {
    entityId: state.entity_id,
    friendlyName: state.attributes.friendly_name ?? state.entity_id,
    state: state.state,
    latitude: state.attributes.latitude,
    longitude: state.attributes.longitude,
    lastUpdated: state.last_updated,
    locationSummary: resolveLocationSummary(state, stateMap),
  };
}
