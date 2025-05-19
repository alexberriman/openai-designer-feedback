import { describe, it, expect } from "vitest";
import { hello } from "./index";

describe("hello", () => {
  it("should return 'world'", () => {
    expect(hello()).toBe("world");
  });
});
