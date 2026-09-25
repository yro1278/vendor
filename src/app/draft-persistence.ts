import { useEffect, useState, useCallback } from "react";
import { getToken } from "./api";

const DRAFT_PREFIX = "trim_vendor_draft_";
const PAGE_KEY = "trim_vendor_current_page";

export type DraftType = "request" | "receiving";

function getUserScopedKey(type: DraftType, extraId?: string): string {
  const token = getToken();
  const userId = token ? btoa(token).slice(0, 16) : "anonymous";
  return `${DRAFT_PREFIX}${type}_${userId}${extraId ? `_${extraId}` : ""}`;
}

function getPageKey(): string {
  const token = getToken();
  const userId = token ? btoa(token).slice(0, 16) : "anonymous";
  return `${PAGE_KEY}_${userId}`;
}

export function saveDraft<T>(type: DraftType, data: T, extraId?: string): void {
  try {
    localStorage.setItem(getUserScopedKey(type, extraId), JSON.stringify(data));
  } catch { }
}

export function loadDraft<T>(type: DraftType, extraId?: string): T | null {
  try {
    const raw = localStorage.getItem(getUserScopedKey(type, extraId));
    if (raw) return JSON.parse(raw) as T;
  } catch { }
  return null;
}

export function clearDraft(type: DraftType, extraId?: string): void {
  try {
    localStorage.removeItem(getUserScopedKey(type, extraId));
  } catch { }
}

export function savePage(page: string): void {
  try {
    localStorage.setItem(getPageKey(), page);
  } catch { }
}

export function loadPage(): string | null {
  try {
    return localStorage.getItem(getPageKey());
  } catch {
    return null;
  }
}

export function clearPage(): void {
  try {
    localStorage.removeItem(getPageKey());
  } catch { }
}

export function useDraftPersistence<T>(
  type: DraftType,
  initialData: T,
  extraId?: string,
  enabled = true
): [T, (data: T | ((prev: T) => T)) => void, boolean] {
  const [data, setData] = useState<T>(initialData);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) {
      setData(initialData);
      setLoaded(true);
      return;
    }
    const draft = loadDraft<T>(type, extraId);
    if (draft) {
      setData(draft);
    }
    setLoaded(true);
  }, [type, extraId, enabled, initialData]);

  const updateData = useCallback((newData: T | ((prev: T) => T)) => {
    setData(prev => {
      const next = typeof newData === "function" ? (newData as (p: T) => T)(prev) : newData;
      if (enabled) saveDraft(type, next, extraId);
      return next;
    });
  }, [type, extraId, enabled]);

  return [data, updateData, loaded];
}

export function usePagePersistence(initialPage: string, enabled = true): [string, (page: string) => void, boolean] {
  const [page, setPage] = useState<string>(initialPage);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const token = getToken();
    if (!token) {
      setPage(initialPage);
      setLoaded(true);
      return;
    }
    const saved = loadPage();
    if (saved) setPage(saved);
    setLoaded(true);
  }, [enabled, initialPage]);

  const updatePage = useCallback((newPage: string) => {
    setPage(newPage);
    if (enabled) savePage(newPage);
  }, [enabled]);

  return [page, updatePage, loaded];
}