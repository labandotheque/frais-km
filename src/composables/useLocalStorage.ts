// @ts-nocheck
import { safeGetLocalStorage, safeSetLocalStorage } from '../utils/storage'

export function useLocalStorage() {
  return {
    safeGetLocalStorage,
    safeSetLocalStorage
  }
}
