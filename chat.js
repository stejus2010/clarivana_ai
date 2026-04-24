// chat.js - Gemini Chatbot integration (with model-controlled word limit)
const GEMINI_API_KEY = "AIzaSyAC6RyMxHDQYqntTJcraeuXAsGY6MJYbjs"; // Replace with your API key
const MODEL = "gemini-2.5-flash"; // Stable version

const chatBox = document.getElementById("chat-box");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");

// Set your word limit here 👇
const WORD_LIMIT = 50;

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  appendMessage(text, "user");
  userInput.value = "";

  appendMessage("Thinking...", "bot", true);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  // 🧠 Instruct the model to limit its response
                  text: `Please answer in under ${WORD_LIMIT} words. ${text}`,
                },
              ],
            },
          ],
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      console.error("Gemini API Error:", data);
      throw new Error(data.error?.message || "Request failed");
    }

    const botReply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn’t process that.";

    removeThinking();
    appendMessage(botReply, "bot");
  } catch (err) {
    console.error(err);
    removeThinking();
    appendMessage("⚠️ Network error or invalid API key.", "bot");
  }
}

function appendMessage(text, sender, temp = false) {
  const div = document.createElement("div");
  div.className = sender === "user" ? "user-msg" : "bot-msg";
  div.textContent = text;
  if (temp) div.id = "thinking-msg";
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeThinking() {
  const msg = document.getElementById("thinking-msg");  
  if (msg) msg.remove();
}

sendBtn.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendMessage();
});
