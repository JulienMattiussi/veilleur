import "@testing-library/jest-dom";
import { vi } from "vitest";

Object.assign(URL, {
  createObjectURL: vi.fn(() => "blob:fake"),
  revokeObjectURL: vi.fn(),
});
