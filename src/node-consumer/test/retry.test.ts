import { describe, expect, it, vi } from "vitest";
import { executeWithRetry } from "../src/retry.js";

describe("executeWithRetry", () => {
  it("returns after a transient failure", async () => {
    const operation = vi
      .fn<(_: number) => Promise<string>>()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue("processed");
    const onRetry = vi.fn();

    const result = await executeWithRetry(operation, 3, [0], onRetry);

    expect(result).toBe("processed");
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("throws after the configured maximum attempts", async () => {
    const operation = vi.fn<(_: number) => Promise<string>>().mockRejectedValue(new Error("down"));

    await expect(executeWithRetry(operation, 3, [0], vi.fn())).rejects.toThrow("down");
    expect(operation).toHaveBeenCalledTimes(3);
  });
});