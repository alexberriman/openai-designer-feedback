// This is a compatibility module to handle ts-results CommonJS imports in an ESM context
import tsResults from "ts-results";

// Re-export the components we need
export const Ok = tsResults.Ok;
export const Err = tsResults.Err;
export type Result<T, E> = tsResults.Result<T, E>;

// Any other exports from ts-results can be added here as needed
