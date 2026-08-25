import test from "node:test";
import assert from "node:assert/strict";
import { isValidUuid, getAuthenticatedUser } from "./auth.js";

test("UUID validation rejects malformed customer IDs", () => {
  assert.equal(isValidUuid("not-a-uuid"), false);
  assert.equal(isValidUuid("11111111-1111-1111-1111-111111111111"), true);
  assert.equal(isValidUuid("738da485-ae91-4e3f-88e8-754999e49851"), true);
});

test("stored user data is rejected when it carries a bad UUID", () => {
  const original = globalThis.localStorage;
  globalThis.localStorage = {
    getItem(key) {
      if (key === "food_delivery_token") {
        return "eyJhbGciOiJub25lIn0.eyJzdWIiOiIxMTExMTExLTExMTEtMTExMS0xMTExLTExMTExMTExMTExMTEiLCJuYW1lIjoiQ2hyaXMiLCJlbWFpbCI6ImNoaXNAZXhhbXBsZS5jb20iLCJyb2xlIjoiQ1VTVE9NRVIiLCJleHAiOjQ3NDE0MzYwMDB9.";
      }
      if (key === "food_delivery_user") {
        return JSON.stringify({
          id: "invalid-uuid",
          name: "Chris",
          email: "chris@example.com",
          role: "CUSTOMER",
        });
      }
      return null;
    },
    removeItem() {},
  };

  try {
    assert.equal(getAuthenticatedUser(), null);
  } finally {
    globalThis.localStorage = original;
  }
});
