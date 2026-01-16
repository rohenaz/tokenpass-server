import { describe, test, expect } from "bun:test";
import { PrivateKey } from "@bsv/sdk";
import Message from "../wallet/bitcore-message";

const messageText = "testing, testing. 1, 2, 3.";
const privateKeyWIF = "L2tfeSVQQ2vKSUzSVx7jEtzERdjfjoFeXcBE6rpqxYnyHJQqsHCs";
const differentAddress = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";

describe("Bitcore Message", () => {
	describe("constructor", () => {
		test("should create a new message", () => {
			const message = new Message(messageText);
			expect(message.message).toBe(messageText);
		});

		test("should throw error when creating a message without a string", () => {
			// @ts-expect-error Testing invalid input
			expect(() => new Message()).toThrow();
			// @ts-expect-error Testing invalid input
			expect(() => new Message(123)).toThrow();
			// @ts-expect-error Testing invalid input
			expect(() => new Message({})).toThrow();
		});

		test("should have default utf8 encoding", () => {
			const message = new Message(messageText);
			expect(message.encoding).toBe("utf8");
		});
	});

	describe("fromString", () => {
		test("should create a message using fromString", () => {
			const text = "Hello, World!";
			const message = Message.fromString(text);
			expect(message.message).toBe(text);
		});

		test("should handle empty string", () => {
			const message = Message.fromString("");
			expect(message.message).toBe("");
		});

		test("should handle unicode", () => {
			const text = "Hello 世界 🌍";
			const message = Message.fromString(text);
			expect(message.message).toBe(text);
		});
	});

	describe("fromJSON", () => {
		test("should create a message using fromJSON with object", () => {
			const text = "Hello, World!";
			const message = Message.fromJSON({ message: text });
			expect(message.message).toBe(text);
		});

		test("should create a message using fromJSON with string", () => {
			const text = "Hello, World!";
			const json = JSON.stringify({ message: text });
			const message = Message.fromJSON(json);
			expect(message.message).toBe(text);
		});

		test("should handle encoding in JSON", () => {
			const text = "Hello, World!";
			const message = Message.fromJSON({
				message: text,
				encoding: "utf8",
			});
			expect(message.message).toBe(text);
			expect(message.encoding).toBe("utf8");
		});
	});

	describe("sign", () => {
		test("should sign a message correctly", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message = new Message(messageText);
			const signature = message.sign(privateKey);

			expect(signature).toBeDefined();
			expect(typeof signature).toBe("string");
		});

		test("should create verifiable signature", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message = new Message(messageText);
			const signature = message.sign(privateKey);

			const isVerified = new Message(messageText).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(isVerified).toBe(true);
		});

		test("should produce different signatures for different messages", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message1 = new Message("Message 1");
			const message2 = new Message("Message 2");

			const sig1 = message1.sign(privateKey);
			const sig2 = message2.sign(privateKey);

			expect(sig1).not.toBe(sig2);
		});

		test("should produce different signatures for different keys", () => {
			const key1 = PrivateKey.fromWif(privateKeyWIF);
			const key2 = PrivateKey.fromRandom();
			const message = new Message(messageText);

			const sig1 = message.sign(key1);
			const sig2 = message.sign(key2);

			expect(sig1).not.toBe(sig2);
		});
	});

	describe("verify", () => {
		test("should verify a valid signature correctly", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message = new Message(messageText);
			const signature = message.sign(privateKey);

			const isVerified = new Message(messageText).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(isVerified).toBe(true);
		});

		test("should not verify an invalid signature", () => {
			const newPrivateKey = PrivateKey.fromRandom();
			const message = new Message(messageText);
			const signature = message.sign(newPrivateKey);

			const isVerified = message.verify(differentAddress, signature);

			expect(isVerified).toBe(false);
		});

		test("should not verify signature with wrong message", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message = new Message(messageText);
			const signature = message.sign(privateKey);

			const wrongMessage = new Message("Different message");
			const isVerified = wrongMessage.verify(privateKey.toAddress(), signature);

			expect(isVerified).toBe(false);
		});

		test("should not verify signature with wrong address", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message = new Message(messageText);
			const signature = message.sign(privateKey);

			const isVerified = message.verify(differentAddress, signature);

			expect(isVerified).toBe(false);
		});

		test("should handle invalid signature format", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const message = new Message(messageText);

			const isVerified = message.verify(
				privateKey.toAddress(),
				"invalid-signature",
			);

			expect(isVerified).toBe(false);
		});
	});

	describe("toObject", () => {
		test("should convert a message to an object", () => {
			const message = new Message(messageText);
			const obj = message.toObject();
			expect(obj).toEqual({ message: messageText, encoding: "utf8" });
		});

		test("should include custom encoding", () => {
			const message = new Message(messageText, "hex");
			const obj = message.toObject();
			expect(obj.encoding).toBe("hex");
		});
	});

	describe("toJSON", () => {
		test("should convert a message to a JSON string", () => {
			const message = new Message(messageText);
			const json = message.toJSON();
			expect(json).toBe(
				JSON.stringify({ message: messageText, encoding: "utf8" }),
			);
		});

		test("should be parseable", () => {
			const message = new Message(messageText);
			const json = message.toJSON();
			const parsed = JSON.parse(json);

			expect(parsed.message).toBe(messageText);
			expect(parsed.encoding).toBe("utf8");
		});
	});

	describe("toString", () => {
		test("should convert a message to a string", () => {
			const message = new Message(messageText);
			const str = message.toString();
			expect(str).toBe(messageText);
		});

		test("should handle empty message", () => {
			const message = new Message("");
			expect(message.toString()).toBe("");
		});
	});

	describe("inspect", () => {
		test("should return a string formatted for the console", () => {
			const message = new Message(messageText);
			const inspect = message.inspect();
			expect(inspect).toBe(`<Message: ${messageText}>`);
		});

		test("should format long messages", () => {
			const longMessage = "a".repeat(100);
			const message = new Message(longMessage);
			const inspect = message.inspect();
			expect(inspect).toBe(`<Message: ${longMessage}>`);
		});
	});

	describe("roundtrip signing and verification", () => {
		test("should roundtrip with random key", () => {
			const privateKey = PrivateKey.fromRandom();
			const message = new Message("Test message");
			const signature = message.sign(privateKey);

			const verified = new Message("Test message").verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});

		test("should handle multiple sign/verify cycles", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const messages = [
				"First message",
				"Second message",
				"Third message",
				"Fourth message",
			];

			for (const text of messages) {
				const message = new Message(text);
				const signature = message.sign(privateKey);
				const verified = new Message(text).verify(
					privateKey.toAddress(),
					signature,
				);

				expect(verified).toBe(true);
			}
		});

		test("should work with special characters", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const specialText = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~";
			const message = new Message(specialText);
			const signature = message.sign(privateKey);

			const verified = new Message(specialText).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});

		test("should work with unicode", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const unicodeText = "Hello 世界 🌍 مرحبا";
			const message = new Message(unicodeText);
			const signature = message.sign(privateKey);

			const verified = new Message(unicodeText).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});

		test("should work with long messages", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const longText = "a".repeat(10000);
			const message = new Message(longText);
			const signature = message.sign(privateKey);

			const verified = new Message(longText).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("should handle newlines in message", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const text = "Line 1\nLine 2\nLine 3";
			const message = new Message(text);
			const signature = message.sign(privateKey);

			const verified = new Message(text).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});

		test("should handle tabs in message", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const text = "Column1\tColumn2\tColumn3";
			const message = new Message(text);
			const signature = message.sign(privateKey);

			const verified = new Message(text).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});

		test("should handle JSON in message", () => {
			const privateKey = PrivateKey.fromWif(privateKeyWIF);
			const jsonText = JSON.stringify({ key: "value", number: 123 });
			const message = new Message(jsonText);
			const signature = message.sign(privateKey);

			const verified = new Message(jsonText).verify(
				privateKey.toAddress(),
				signature,
			);

			expect(verified).toBe(true);
		});
	});
});
