import "@testing-library/jest-dom";

Object.assign(URL, {
  createObjectURL: vi.fn(() => "blob:fake"),
  revokeObjectURL: vi.fn(),
});
