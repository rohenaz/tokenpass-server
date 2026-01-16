import { PrivateKey } from "@bsv/sdk";
import Message from "./bitcore-message.ts";

const messageText = "testing, testing. 1, 2, 3.";
// valid pk
const privateKeyWIF = "L2tfeSVQQ2vKSUzSVx7jEtzERdjfjoFeXcBE6rpqxYnyHJQqsHCs";
// known different address
const differentAddress = "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa";

describe("Bitcore Message", () => {
	it("should create a new message", () => {
		const message = new Message(messageText);
		expect(message.message).toBe(messageText);
	});

	it("should throw error when creating a message without a string", () => {
		expect(() => new Message()).toThrow();
		expect(() => new Message(123)).toThrow();
		expect(() => new Message({})).toThrow();
	});

	it("should create a message using fromString", () => {
		const messageText = "Hello, World!";
		const message = Message.fromString(messageText);
		expect(message.message).toBe(messageText);
	});

	it("should create a message using fromJSON", () => {
		const messageText = "Hello, World!";
		const message = Message.fromJSON({ message: messageText });
		expect(message.message).toBe(messageText);
	});

	describe("#sign()", () => {
		it("should sign a message correctly", () => {
			// create a private key
			const privateKey = PrivateKey.fromWif(privateKeyWIF);

			// create a message
			const message = new Message(messageText);

			// sign the message
			const signature = message.sign(privateKey);

			// create a new message and verify the signature
			const isVerified = new Message(messageText).verify(
				privateKey.toAddress(),
				signature,
			);

			// check that the signature is valid
			expect(isVerified).toBe(true);
		});
	});

	describe("#verify()", () => {
		it("should verify a valid signature correctly", () => {
			// create a private key
			const privateKey = PrivateKey.fromWif(privateKeyWIF);

			// create a message
			const message = new Message(messageText);

			// sign the message
			const signature = message.sign(privateKey);

			// create a new message and verify the signature
			const isVerified = new Message(messageText).verify(
				privateKey.toAddress(),
				signature,
			);

			// check that the signature verifies correctly
			expect(isVerified).toBe(true);
		});

		it("should not verify an invalid signature", () => {
			// create a new private key
			const newPrivateKey = PrivateKey.fromRandom();

			// create a message
			const message = new Message(messageText);

			// sign the message with the new private key
			const signature = message.sign(newPrivateKey);

			// attempt to verify the signature with the different address
			const isVerified = message.verify(differentAddress, signature);

			// check that the signature does not verify
			expect(isVerified).toBe(false);
		});

		it("should create a new message using Message.fromString", () => {
			const message = Message.fromString(messageText);
			expect(message.message).toBe(messageText);
		});

		it("should create a message using fromJSON", () => {
			const messageText = "Hello, World!";
			const json = JSON.stringify({ message: messageText });
			const message = Message.fromJSON(json);
			expect(message.message).toBe(messageText);
		});

		it("should convert a message to an object", () => {
			const message = new Message(messageText);
			const obj = message.toObject();
			expect(obj).toEqual({ message: messageText, encoding: "utf8" });
		});

		it("should convert a message to a JSON string", () => {
			const message = new Message(messageText);
			const json = message.toJSON();
			expect(json).toBe(
				JSON.stringify({ message: messageText, encoding: "utf8" }),
			);
		});

		it("should convert a message to a string", () => {
			const message = new Message(messageText);
			const str = message.toString();
			expect(str).toBe(messageText);
		});

		it("should return a string formatted for the console", () => {
			const message = new Message(messageText);
			const inspect = message.inspect();
			expect(inspect).toBe(`<Message: ${messageText}>`);
		});
	});
});
