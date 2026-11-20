InterACT — Complete Product Vision and Detailed Product Requirements
We should treat InterACT as more than a Zomato support-call demo. The Zomato-style experience is the first demonstration environment for a larger product: an accessibility communication infrastructure that lets people who cannot reliably use conventional voice calls communicate with businesses, service providers and institutions.

The product will have one shared communication engine and two deployment channels:
1. Digital integrations: An accessibility SDK that businesses can integrate into their existing apps, websites and voice-support experiences.
2. Physical deployments: An iPad-based accessibility kiosk for hospitals, banks and other customer-service environments.
This sprint will deliver a working multimodal communication platform, speech assistance, personalized gesture controls, reusable integration interfaces and kiosk workflows.

Genuine Indian Sign Language (ISL) recognition, translation and avatar signing will be deliberately deferred to the next sprint. We should not imply that personalized gestures are ISL.

Part 1 — The complete InterACT idea
1. The problem
A large part of customer service is still designed around voice.

A customer is expected to:
- Call a helpline.
- Listen to an automated IVR.
- Understand spoken instructions.
- Explain their problem verbally.
- Answer questions quickly.
- Navigate a conversation without visual support.
This creates barriers for people who are deaf, hard of hearing, non-speaking, or who experience stammering and other speech difficulties.

Consider three situations.

Situation A — A non-speaking customer

A customer calls a food-delivery platform because an order is missing an item. The agent asks, "What is missing from your order?"

The customer may be unable to answer verbally. Typing everything takes time, and conventional call interfaces provide no convenient way to communicate.

Situation B — A customer who stammers

A customer calls a bank to report a stolen card. They know exactly what they need to say, but speech blocks and repetitions make the interaction difficult. The agent may misunderstand, interrupt, or ask them to repeat themselves.

Situation C — A deaf customer

A customer visits a hospital. The receptionist asks questions verbally, explains a process and gives instructions. The customer cannot reliably access that spoken interaction.

These are not isolated app problems. They are failures of the communication interface.
2. The solution
InterACT
One accessibility engine. Multiple communication channels.

InterACT is a multimodal accessibility communication platform that sits between a customer and an organization.

It provides alternative ways to express, receive and understand information without forcing the customer to depend exclusively on spoken communication.

The platform combines:
- Speech capture and transcription.
- Disfluency-aware speech assistance.
- Customer-approved speech reconstruction.
- Text-to-speech communication.
- Personalized gesture-to-phrase controls.
- Context-aware suggested responses.
- Visual information cards.
- Real-time customer-agent communication.
- Enterprise APIs and SDK integration.
- Physical accessibility kiosks.
The fundamental design principle is:

The customer chooses how to communicate. The business continues using its existing service workflow.

InterACT translates between those interaction methods.
3. Who uses InterACT?










Customer

A person who needs an accessible way to communicate with an organization. They use speech, text, personalized gestures and visual responses.













Agent / Staff member

A customer-support representative, receptionist, bank employee or service professional. They communicate normally and receive accessible customer messages through an agent interface.













Enterprise administrator

The organization that configures workflows, services, supported languages, accessibility options, devices and staff access.



4. The two deployment channels
Channel A — Digital accessibility SDK








dribbble.com


This is the digital deployment model.

A business already has an app or website. InterACT provides an accessibility communication interface that can be integrated into that experience.

Examples:
- Food delivery support.
- Banking support.
- Telehealth consultations.
- Insurance customer service.
- Logistics and delivery support.
- Enterprise voice-support applications.
The SDK exposes communication capabilities without requiring every company to build its own accessibility engine.

Example: Zomato-inspired support demonstration

A customer opens a mock food-delivery app, selects an active order and taps Accessible Support.

The customer enters an InterACT session. An agent joins through a separate interface.

The customer can:
- Type a message and have it spoken to the agent.
- Use suggested responses based on their active order.
- Use personalized gesture macros.
- Speak and use Fluency Shield.
- Receive structured visual responses from the agent.
The agent can:
- Speak normally.
- Read transcribed customer messages.
- Receive approved reconstructed speech.
- See the relevant order context.
- Send visual information cards.
This is a simulated enterprise integration, not an official Zomato integration.
Channel B — Physical accessibility kiosk








xchange.avixa.org


The second deployment channel is a physical iPad kiosk.

A hospital, bank or other institution can place a tablet at its reception or customer-service desk.

A customer can use it without needing to install an application.

The kiosk provides:
- Accessible welcome screen.
- Language and communication-mode selection.
- Text-based communication.
- Text-to-speech.
- Speech capture and assistance.
- Personalized gestures, where enabled.
- Visual instructions and response cards.
- Staff-assisted communication.
- Session completion and reset.
The kiosk and digital SDK must use the same underlying communication services. They must not become two unrelated products.
5. The four central accessibility capabilities
5.1 Fluency Shield — Speech assistance








alternativeto.net


Fluency Shield helps a customer who can speak but may experience stammering, repetitions, blocks or other speech disfluencies.

How it works
1. The customer activates the microphone.
2. InterACT captures speech.
3. Speech recognition produces a transcript.
4. The system identifies possible disfluencies and constructs a clearer version of the intended message.
5. The customer sees both the original transcript and proposed reconstruction.
6. The customer can accept, edit or reject the reconstruction.
7. Only after approval does InterACT generate speech for the agent.
Example:
Stage	Message
Spoken input	"I... I need to block my... my card."
Raw transcription	"I I need to block my my card."
Proposed reconstruction	"I need to block my card."
Customer action	Reviews and approves
Agent receives	Spoken approved message

The most important requirement is semantic preservation.

InterACT must not:
- Change the customer's request.
- Infer an action the customer did not ask for.
- Remove meaningful uncertainty.
- Silently make decisions on behalf of the customer.
If the message is ambiguous, InterACT should ask the customer to clarify rather than invent a cleaner interpretation.

This is not a claim to cure stammering. It is a communication aid that gives the customer control over how their message is presented.
5.2 Personalized Gesture Macros








steam.oxxostudio.tw


This feature gives customers a visual, hands-free alternative to typing every message.

The customer can teach a gesture and associate it with a phrase.

Example presets:
Gesture	Configured phrase
Open palm	"Please wait a moment."
Thumbs up	"Yes, I confirm."
Thumbs down	"No, I disagree."
Pointing gesture	"There is a missing item."
Fist	"Please repeat that."
V-sign	"Thank you."

The customer can also create custom gestures.

Personalization workflow
1. Open gesture settings.
2. Select Create gesture.
3. Enter or select a phrase.
4. Record several examples of the gesture.
5. InterACT extracts hand landmarks locally.
6. It normalizes the landmarks and stores a gesture template.
7. During a session, the camera detects a matching gesture.
8. The system checks confidence and stability.
9. It displays the detected phrase for confirmation or sends it according to the customer's configured confirmation preference.
Technical implementation:
- MediaPipe hand landmark detection.
- 21 landmarks per hand.
- Three-dimensional coordinates.
- Normalization relative to the wrist and hand scale.
- Multiple recorded examples per gesture.
- Similarity matching and confidence thresholds.
- Temporal stability checks to prevent accidental triggers.
- Local processing wherever supported.
A critical distinction: this is a personalized gesture-command system, not genuine ISL recognition. It cannot understand arbitrary signs or translate ISL sentences.
5.3 Smart Voice Chips — Context-aware responses








dribbble.com


Smart Voice Chips make it easier for customers to respond to an agent without typing a complete sentence.

They use two inputs:
- The current business context.
- The agent's most recent message.
Example:
Order #ZMT-4092
Mock order

Paneer Tikka · ₹320 · Delivery in progress

Agent says:

"Would you like a replacement or a refund?"

Suggested responses
Send replacement


Request refund


Explain the issue


I need help



Illustrative interface. A customer selects a response and InterACT can speak it to the agent.
The response generator should use constrained, structured context. It should not invent order details or select a financial outcome for the customer.

The customer always chooses the response.
5.4 Visual communication and Anti-Hangup Shield
These features make the interaction more accessible for customers who need additional time or visual information.

Visual communication

Instead of relying on spoken explanations alone, the agent can send structured cards.

Examples:
- Refund amount.
- Refund method.
- Estimated resolution time.
- Appointment time.
- Queue number.
- Bank-service instructions.
- Confirmation request.
The cards should be generated from structured data, not free-form text alone.

Anti-Hangup Shield

When the customer is typing, reviewing a speech reconstruction or composing a message, the agent interface displays an activity state.

For example:
- Customer is typing.
- Customer is preparing a response.
- Customer is reviewing a message.
- Customer needs more time.
- Customer has sent a response.
This prevents an agent from assuming that silence means the customer has disconnected.

The interface may also show a gentle message such as:
The customer is preparing a response. Please allow a moment.

It is a session-status feature. It must not be described as injecting audio into a real telephone call unless an actual telephony integration has been implemented.
6. The full customer-agent experience






















10











Customer journey
1. Customer opens the business app or approaches an iPad kiosk.
2. Customer chooses an accessible communication option.
3. InterACT creates or joins a session.
4. An agent joins the session.
5. Customer selects their communication method.
6. InterACT delivers customer messages in an agent-readable and, where approved, spoken form.
7. Agent responds through speech or visual cards.
8. Customer receives the response in an accessible format.
9. Session closes and sensitive session data is cleared according to the configured retention policy.
Agent journey
1. Agent opens the support dashboard.
2. Agent accepts or joins a session.
3. Agent sees the customer's communication preferences and relevant business context.
4. Agent speaks normally or sends a visual response.
5. InterACT presents incoming customer messages.
6. Agent can see whether the customer is composing, reviewing or responding.
7. Agent resolves the request and ends the session.
7. SDK and enterprise integration
The SDK is what makes InterACT a platform rather than a single demonstration application.

A business should not need to rebuild speech capture, gesture detection, message routing and accessible response interfaces.

The integration package should provide:
- Session creation and termination.
- Customer connection.
- Agent connection.
- Typed event handling.
- Text-to-speech interfaces.
- Speech transcription interfaces.
- Smart response interfaces.
- Visual card interfaces.
- Communication status events.
- Authentication and session permissions.
- Integration documentation.
- Sample applications.
The first SDK target should be a TypeScript package for web applications, supported by stable backend APIs. Native iPad kiosk integration can consume the same API contracts through a native SwiftUI client.

We should only call it a reusable SDK once a separate sample host application successfully integrates it without copying the original demo's implementation.
8. The iPad kiosk experience
The kiosk should be designed for a customer who may be unfamiliar with the application and may be under stress.

Its interface should have:
- Large touch targets.
- Clear language selection.
- Minimal navigation.
- High contrast.
- Readable typography.
- Clear microphone and text-input controls.
- Visual feedback for every action.
- An obvious way to request staff assistance.
- Automatic session reset after completion or timeout.
Hospital workflow
A customer approaches the kiosk and selects Hospital Assistance.

Possible workflow:
1. Appointment assistance.
2. Registration guidance.
3. Queue information.
4. Department navigation.
5. Basic service questions.
6. Staff assistance.
Bank workflow
A customer selects Banking Assistance.

Possible workflow:
1. Account-service navigation.
2. Card-blocking assistance.
3. Transaction-support request.
4. Branch-service information.
5. Support-agent connection.
The initial implementation should simulate sensitive workflows using synthetic data. A real card-blocking action, payment action or medical-record lookup requires explicit enterprise integration and authorization.
9. What is deliberately not part of this sprint?
Genuine ISL is a separate and substantial engineering initiative.

We will not claim to deliver:
- Validated temporal ISL recognition.
- A validated ISL vocabulary.
- ISL sentence translation.
- Gloss sequence generation.
- Linguistic reconstruction of ISL sentences.
- Agent-to-customer signing.
- Validated gloss-to-avatar animations.
These capabilities will be handled in the next sprint with their own datasets, evaluation criteria, linguistic validation and model pipeline.

This separation matters: a handful of hand poses mapped to phrases is not sign-language understanding.
10. What InterACT becomes after this sprint
InterACT will have a working shared accessibility engine with two real deployment surfaces.
Capability	This sprint
Text-to-voice communication	Included
Speech capture and transcription	Included
Disfluency-aware reconstruction	Included
Customer confirmation	Included
Personalized gesture macros	Included
Smart Voice Chips	Included
Agent voice and visual responses	Included
Anti-Hangup Shield	Included
Reusable TypeScript SDK	Included
Backend APIs and documentation	Included
iPad kiosk UX	Included
Hospital and bank demo workflows	Included
Genuine ISL translation	Next sprint
Signing avatar	Next sprint

The product's central promise is not that every accessibility problem has already been solved. It is that organizations can use one engine to offer multiple accessible communication methods through their existing customer-service experiences.


Yes. This is an important addition to InterACT, and I would make it a **core feature rather than just a Smart Voice Chips enhancement**.

What you're describing is a context-aware conversational response engine:

- The agent speaks or types a message.
- InterACT understands what the agent is asking.
- It checks the actual order, delivery or service context.
- Gemini generates 3–4 natural responses the customer could give.
- The customer taps one.
- InterACT converts the selected response into speech.
- The spoken response is played to the agent through the active communication session.

The key is that these responses should sound like something a real person would naturally say—not generic chatbot buttons.

For example, if a delivery customer asks, "Hello, bhaiya, kahaan ho?", the system should use the rider's verified delivery state to generate appropriate responses.

## **1. Google AI models I recommend for InterACT**

I would use Google Gemini for the language and speech intelligence, but **not one Gemini model for everything**. Different tasks need different models, and some tasks should be handled by ordinary application logic rather than AI.

Google's current developer lineup includes dedicated transcription, live speech and TTS models, as well as general-purpose Gemini models.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://blog.google\&sz=32)

blog.google+2



## **Recommended Google AI stack**

[Gemini – Google’s AI Assistant for Smart Conversations & Productivity – Daidu.ai](https://images.openai.com/static-rsc-4/ptJvxAnbpHSz9oKwhiZCWU9MTvmPl997rGrZd4wqTgvg18xJPt8X3ASwCANnmkTN4cvnMJqTW5csYg-Wx_SyU_pL6waVf_YLfxdwlsLklzd2H22udrktQ6oVGaeLOvjKRl8y4lJCZGtYV2I-4GwcwBjAGawfKX-wZYbv6TzRORU?purpose=inline)

**Gemini 3.8 Flash**

Primary recommendation

**Purpose:** Context-aware response generation, natural-language reconstruction, Smart Voice Chips, and structured reasoning.

[Google's upgraded Gemini 2.5 Flash Native Audio model makes AI more conversational | Android Central](https://images.openai.com/static-rsc-4/jDPgh3YVEF8VbsHL51sRy74Jk1IP4HXZ_EjbghXteLg0Xz0vKVqUTZGuldg0OHG5mx15bA8B-KqGsY88LWyPO-ihc8Q7zLdIBvpRn2h99hPBl6pg6ybJrOTqLV0uMPr6LkN55D04wn8rFXDWoQPj627Qn7Wl04a2C6tAD85Pv-w?purpose=inline)

**Gemini 3.5 Transcribe**

**Purpose:** Customer and agent speech-to-text, multilingual transcription, code-switching and speech capture.

[Голосовой помощник Gemini стал лучше понимать инструкции и не перебивает пользователей](https://images.openai.com/static-rsc-4/tq5ASVUvt5Kg0qlGKZMzgOQ_9XKHhh5LoiWKbzKdICuZA0MEP-COjkTb2vaGkoD0wwUvS4V5gVbttJTcXKgYqvMKRNUnXNiLkRG6flBE4VT9xsIrlCntJmyDTAP2jMk9RAw9MZv92Z6O2GD7HxNzUqaCaPsZ6Z7Ciu0iy5nYKhI?purpose=inline)

**Gemini 3.8 Flash-Lite TTS**

**Purpose:** Generate natural spoken versions of selected response chips and approved messages. Efficient for conversational speech generation.

[Google rolls out new Gemini Live features with screen-sharing capabilities - India Today](https://images.openai.com/static-rsc-4/bJyivrzi9Jqix5KRqhgXARyNr18MTg9RlPcw3p0qcysJnGXPY9WzpAQS66Olfrx6Cc4LXZjZGawL6h0bNGZEzZoETjXrOMjH3lQElJ9lKounzMdpyaBmzYod_J_eT2_4SnQT4nGOSZyCHwReGs47qqMoxkl3b8aarxwjnwxyhq0?purpose=inline)

**Gemini 3.8 Live**

**Purpose:** Optional future real-time speech-to-speech interaction, when we want a continuous conversational voice agent rather than a transcription-plus-response pipeline.

[Google launches Gemini 2.5 Flash-Lite, faster and cheaper](https://images.openai.com/static-rsc-4/hKzx2TFJYwZQQnHLGXVkQVldhQ5JQn6fMyiRR8JKaEpTOArw_zaIIs5ieCHfyvEPOfiSZBRmzpIqM8ggF5xUJxUUJf8w86lDLRuZcmBeihG6Vj2vanTfzhkOVEoPWt_UGyzjSRGUyH1KxY485K2pp2jxm9dIT2aB5m85AxY5BLA?purpose=inline)

**Gemini 3.5 Flash-Lite**

**Purpose:** Lower-cost, high-volume tasks such as intent classification, message categorization and lightweight response processing.

### **What each model will actually do**

| InterACT capability          | Google model / technology     | Responsibility                                             |
| ---------------------------- | ----------------------------- | ---------------------------------------------------------- |
| Speech recognition           | Gemini 3.5 Transcribe         | Convert spoken audio to text                               |
| Fluency Shield               | Transcribe + Gemini 3.8 Flash | Preserve original transcript and propose a clearer version |
| Smart Voice Chips            | Gemini 3.8 Flash              | Generate 3–4 natural, contextually correct responses       |
| Lightweight intent detection | Gemini 3.5 Flash-Lite         | Classify messages and route workflows                      |
| Voice generation             | Gemini 3.8 Flash-Lite TTS     | Speak approved messages                                    |
| Advanced live voice          | Gemini 3.8 Live               | Optional future speech-to-speech mode                      |
| Hand detection               | MediaPipe                     | Detect 21 hand landmarks locally                           |
| Gesture matching             | Local gesture engine          | Match personalized gestures to phrases                     |

Google describes Gemini 3.5 Transcribe as supporting 85+ languages, code-switching and domain-specific vocabulary. Its smart transcription mode can also remove filler words and format speech. That makes it particularly relevant to Fluency Shield, although we must preserve a separate original transcript and not treat automatic cleanup as customer approval.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://blog.google\&sz=32)

blog.google+1



For speech output, Google's current TTS documentation describes Gemini 3.8 Flash-Lite TTS as suited to high-volume conversational voice workloads, while the full Flash TTS model is more appropriate when expressive control and acoustic fidelity are the priority.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://docs.cloud.google.com\&sz=32)

docs.cloud.google.com+1



**My recommendation:** Start with Gemini 3.8 Flash + Gemini 3.5 Transcribe + Gemini 3.8 Flash-Lite TTS. Add Flash-Lite for lightweight tasks when we have measured a real need. Keep Gemini Live optional; don't make the initial architecture depend on it.

## **2. The new feature: Context-aware AI Voice Responses**

This is the part I would elevate in the PRD.

The feature should be called:

# **InterACT Contextual Voice Chips**

Understand the conversation. Understand the situation. Suggest what to say.

The idea is simple: a customer or agent should not have to compose every sentence manually. InterACT should understand the current business situation and offer a few natural, accurate things the person could say.

The customer chooses one. InterACT speaks it.

This is more powerful than static quick replies because the responses change as the real-world situation changes.

### **Example: Delivery rider support**

Imagine the customer asks the rider:

> "Hello, bhaiya kahaan ho?"

The application has access to the rider's verified delivery context.

**Delivery context**

On the way

Order

**ZMT-4092**

Delivery status

**Picked up**

Distance

**1.2 km**

Estimated arrival

**4 minutes**

**Customer's latest message**

"Hello, bhaiya kahaan ho?"

Gemini-generated response suggestions · illustrative

**1. Natural**

"Ji sir, order le liya hai, abhi aapki taraf aa raha hoon."

Tap to speak

**2. Friendly**

"Bas sir, 4 minute mein pahunchne wala hoon."

Tap to speak

**3. Polite**

"Ji sir, main raste mein hoon. Thodi der mein pahunch jaunga."

Tap to speak

**4. Short**

"Sir, bas aapke paas hi aa raha hoon."

Tap to speak

Conceptual interaction preview. Responses must be generated from actual order and rider state, not assumed facts.

This is the experience we want: four different ways to express the same truthful information, in natural conversational language.

## **3. How the feature works technically**

The most important architecture decision:

**Gemini generates the wording. InterACT's backend supplies the facts.**

Never let Gemini invent the rider's location, order status or ETA.

**1. Conversation input**

"Hello, bhaiya kahaan ho?"

**2. Context retrieval**

Order status · Rider GPS · ETA · Language · Conversation history

**3. Gemini 3.8 Flash**

Understands the question and generates 3–4 grounded, natural responses

**4. Voice Chips**

Customer/rider sees selectable responses

**5. Customer selects a response**

Explicit tap and confirmation

**6. Gemini TTS**

Generate the selected spoken response

**7. Audio delivery**

Play to the other participant through the active communication audio channel

### **Step 1 — Get trusted context**

Your backend should retrieve a structured snapshot:

```
{
  "business": "food_delivery",
  "order": {
    "order_id": "ZMT-4092",
    "status": "picked_up"
  },
  "rider": {
    "status": "on_the_way",
    "distance_km": 1.2,
    "eta_minutes": 4
  },
  "customer": {
    "language": "Hindi",
    "preferred_style": "natural_hinglish"
  }
}
```

GPS and ETA should come from the delivery system or its mock equivalent. Calculate distance and ETA using your backend or routing service. Do not ask Gemini to calculate a live location from a conversation.

### **Step 2 — Understand the message**

Gemini receives:

- Latest customer utterance.
- Recent conversation context.
- Verified business state.
- Desired language.
- Desired tone.
- Allowed response count.

It identifies the intent as `ASK_RIDER_LOCATION`.

### **Step 3 — Generate structured options**

Gemini should return JSON, not an uncontrolled paragraph.

Example:

```
{
  "intent": "ASK_RIDER_LOCATION",
  "language": "hi-Latn",
  "responses": [
    {
      "id": "r1",
      "text": "Ji sir, order le liya hai, abhi aapki taraf aa raha hoon.",
      "style": "natural",
      "grounded_facts": ["picked_up", "on_the_way"]
    },
    {
      "id": "r2",
      "text": "Bas sir, 4 minute mein pahunchne wala hoon.",
      "style": "friendly",
      "grounded_facts": ["eta_minutes"]
    },
    {
      "id": "r3",
      "text": "Ji sir, main raste mein hoon. Thodi der mein pahunch jaunga.",
      "style": "polite",
      "grounded_facts": ["on_the_way"]
    },
    {
      "id": "r4",
      "text": "Sir, bas aapke paas hi aa raha hoon.",
      "style": "short",
      "grounded_facts": ["on_the_way"]
    }
  ]
}
```

### **Step 4 — Generate speech only after selection**

Do not generate four audio files before the customer has selected one unless caching is justified by measured latency.

A better initial flow:

1. Generate four text options.
2. Customer taps one.
3. Send the selected text to TTS.
4. Generate audio.
5. Deliver audio to the other participant.
6. Show the sent message and playback state.

This reduces unnecessary audio generation and gives the customer control.

## **4. The critical feature: Responses must change with live context**

The same question must produce different responses depending on the actual situation.

| Actual rider state        | Appropriate response examples                               |
| ------------------------- | ----------------------------------------------------------- |
| Order not picked up       | "Sir, restaurant se order collect kar raha hoon."           |
| Order picked up           | "Ji sir, order le liya hai."                                |
| On the way                | "Sir, aapki taraf aa raha hoon."                            |
| Near destination          | "Sir, main aapke location ke paas pahunch gaya hoon."       |
| Waiting at delivery point | "Sir, main neeche wait kar raha hoon."                      |
| Delivery delayed          | "Sir, thodi deri ho rahi hai, main aapko update deta hoon." |

A very important safeguard: do not generate "Bas 2 minute mein pahunch raha hoon" if the backend only knows that the rider is on the way and has no reliable ETA.

The system should use only supported facts. If the ETA is unavailable, generate a response that doesn't include a time estimate.

## **5. Make it work in both directions**

This should not be limited to delivery riders. It should become a general InterACT service.

For example:

**Customer asks:** "Where is my refund?"

Backend context says refund initiated, expected in 3–5 working days.

The agent sees four possible responses:

- "Your refund has been initiated."
- "The amount should reflect within 3–5 working days."
- "It's already being processed by your bank."
- "Let me share the refund reference with you."

These are only allowed if the backend actually confirms those facts.

**Hospital receptionist receives:** "When is my appointment?"

The system uses the appointment record to generate relevant responses.

**Bank employee receives:** "Has my card been blocked?"

The system uses the actual card-service status, rather than guessing.

That makes Contextual Voice Chips a reusable service across InterACT's digital and kiosk deployments.

## **6. Prompt design for Gemini**

The following is a starting system instruction for the response-generation service.

# InterACT Contextual Voice Response Generator

You generate natural spoken response options for an accessibility communication platform.

Your purpose is to help a participant respond to the latest message using verified business context.

## Inputs

You will receive:

1. Latest conversation message.
2. Recent conversation history.
3. Verified business or service context.
4. Current participant role.
5. Desired language.
6. Desired communication style.
7. Required number of response options.

## Rules

1. Generate exactly four response options unless the input explicitly requests a different number.
2. Responses must sound like natural human conversation.
3. Match the language and conversational register of the user.
4. Support Hindi, Hinglish and English according to the requested language.
5. Use relevant context to make responses specific.
6. Never invent location, delivery status, ETA, refund status, appointment details, account status or other business facts.
7. Do not promise an action that has not been confirmed by the business system.
8. Do not create four nearly identical responses.
9. Provide meaningful variation in length and conversational style.
10. Preserve the intended meaning of the response.
11. Do not make financial, medical or account decisions.
12. If required information is missing, generate safe responses that avoid unsupported claims.
13. If no suitable response can be generated, return a clarification-needed result.
14. Responses must be short enough to work as spoken conversational replies.
15. Do not include explanations or commentary outside the structured response.

## Variation

Where appropriate, generate:

- Natural conversational.
- Friendly.
- Polite.
- Short and direct.

Do not force unnatural stylistic variation when the situation requires a specific response.

## Output

Return valid structured JSON containing:

- intent
- language
- responses
- response ID
- response text
- style
- grounded facts
- clarification-needed status

Every generated factual statement must be supported by the supplied context.

## **7. One important technical issue: "Voice over call"**

There are two different implementations, and we must not confuse them.

**Option A — Audio playback inside the InterACT session**

The selected response is synthesized and played to the other participant in the customer/agent application. This can work with the existing application-level communication experience.

**Option B — Actual voice-call audio**

The generated audio is inserted into a real-time WebRTC audio stream so the other participant hears it as part of the call.

For the intended SDK and future VoIP product, Option B is the stronger architecture.

However, your existing Phase 1 WebSocket communication engine does not, by itself, provide a real-time voice-call media path. We would need WebRTC or another audio transport layer.

For the current demonstration, I recommend:

- Keep WebSocket for session management, events and message metadata.
- Use a separate audio transport path.
- Use WebRTC when we implement actual two-way live audio.
- Keep the selected text and generated audio associated with the same message ID.
- Display playback and delivery status.

Do not send large audio files as ordinary JSON WebSocket messages.

Also, a generated spoken response is not the same as an actual PSTN telephone call. We should label the demo honestly.

## **8. Update to the InterACT PRD**

I would add this as a new first-class module, not bury it inside the old Smart Voice Chips section.

# PRD Addition — InterACT Contextual Voice Response Engine

## Objective

Generate context-aware, natural-language spoken response suggestions for customers, agents, riders and staff.

The system combines:

- Conversation context.
- Verified business state.
- Current workflow.
- Participant role.
- Preferred language.
- Conversational tone.

It produces three or four concise response options. The participant selects one, and InterACT generates spoken audio and delivers it through the active communication channel.

## Functional requirements

### FR-CVR-001: Context ingestion

The backend must provide structured, verified business context to the response-generation service.

Examples:

- Order status.
- Rider delivery status.
- Rider distance.
- Verified ETA.
- Refund status.
- Appointment information.
- Banking workflow status.

The language model must not be the source of truth for business state.

### FR-CVR-002: Conversation understanding

The system must interpret the latest customer or agent message and identify its communication intent.

Example intents:

- ASK_RIDER_LOCATION
- ASK_DELIVERY_ETA
- ASK_ORDER_STATUS
- ASK_REFUND_STATUS
- REQUEST_CONFIRMATION
- ASK_APPOINTMENT_TIME
- ASK_CARD_STATUS
- REQUEST_CLARIFICATION

### FR-CVR-003: Contextual response generation

Use Gemini 3.8 Flash as the initial response-generation model.

Generate exactly four options by default.

Each option must:

- Be contextually relevant.
- Be factually grounded.
- Be concise.
- Sound natural when spoken.
- Match the selected language.
- Have a unique response ID.
- Include its conversational style.
- Include the facts supporting the response.

### FR-CVR-004: Response diversity

Where appropriate, generate:

- Natural conversational.
- Friendly.
- Polite.
- Short and direct.

Avoid duplicate or nearly identical options.

### FR-CVR-005: Language support

Initial target languages:

- Hindi.
- Hinglish.
- English.

Additional languages may be enabled when the selected speech transcription and TTS providers have been tested for them.

### FR-CVR-006: Customer selection

The participant must explicitly select a response.

No generated suggestion may be automatically sent.

### FR-CVR-007: Text-to-speech

Use Gemini 3.8 Flash-Lite TTS for the initial speech-generation implementation.

The TTS service must:

- Generate speech from the selected response only.
- Support the configured voice.
- Return an audio asset or stream.
- Associate the output with the selected message ID.
- Report generation errors.
- Support retry.

### FR-CVR-008: Audio delivery

The generated audio must be delivered to the other participant through the supported audio transport.

The implementation must distinguish:

- Application audio playback.
- WebRTC call audio.
- PSTN or SIP telephony integration.

Do not claim actual telephone-call audio integration unless implemented and tested.

### FR-CVR-009: Business-state grounding

The service must never invent:

- Delivery status.
- Rider location.
- ETA.
- Refund completion.
- Transaction status.
- Appointment details.
- Account status.

If the necessary context is unavailable, generate safe responses without unsupported facts or request clarification.

### FR-CVR-010: Fallback behavior

If Gemini is unavailable:

- Preserve the original conversation.
- Provide deterministic template responses where available.
- Allow manual text entry.
- Do not fabricate suggestions.

### FR-CVR-011: Observability

Record:

- Context version or snapshot ID.
- Model ID.
- Generation latency.
- Number of generated options.
- Selection event.
- TTS latency.
- Audio delivery status.
- Error state.

Do not store sensitive conversation content in logs unnecessarily.

## Acceptance criteria

- Four relevant response options can be generated from a conversation message.
- Responses change when verified business context changes.
- Unsupported factual claims are rejected or avoided.
- The participant can choose one response.
- The selected text is converted into speech.
- The other participant can hear the generated speech through the supported audio channel.
- Generation and playback failures have usable fallbacks.
- The feature works in the food-delivery demo and can be reused in hospital and banking workflows.

## **9. Final recommended AI architecture**

## **InterACT AI stack**

**Speech intelligence**

## **Gemini 3.5 Transcribe**

Microphone → transcript → language detection and transcription metadata

**Language intelligence**

## **Gemini 3.8 Flash**

Fluency Shield reconstruction · intent · contextual response options · structured output

**Speech generation**

## **Gemini 3.8 Flash-Lite TTS**

Approved text → natural spoken audio

**Optional live voice engine**

## **Gemini 3.8 Live**

Future continuous speech-to-speech conversations

**Local computer vision**

## **MediaPipe**

Local hand landmarks → personalized gesture matching

**Trusted application services**

FastAPI · Session engine · Order context · Rider location · ETA · Business workflows · WebSocket · WebRTC

### **Final product recommendation**

I would now describe Smart Voice Chips as **Contextual Voice Chips**, a major InterACT capability.

The difference is important:

- Traditional quick replies are static.
- AI-generated quick replies are conversational.
- InterACT Contextual Voice Chips are conversational **and grounded in the live state of the business workflow**.

That third property is the product differentiator.

For the Zomato-inspired demo, I would make this one of the first features judges experience: the customer asks a question, the rider's actual mock delivery state changes the four suggested replies, and tapping a response produces natural spoken audio.

One last implementation note: Google's model availability and API surfaces differ between the Gemini Developer API and Gemini Enterprise Agent Platform. Before coding, pin the exact supported model IDs and API surface in the project configuration rather than hardcoding them throughout the app.&#x20;

[image](https://www.google.com/s2/favicons?domain=https://firebase.google.com\&sz=32)

firebase.google.com+2



Useful official references:

- [Gemini API models](https://ai.google.dev/gemini-api/docs/models?utm_source=chatgpt.com)
- [Gemini audio and Live API announcement](https://blog.google/innovation-and-ai/technology/developers-tools/build-real-time-voice-applications-gemini-audio/?utm_source=chatgpt.com)
- [Gemini TTS documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/text-to-speech/overview?utm_source=chatgpt.com)

**My next recommendation:** update the main PRD with this Contextual Voice Response Engine before giving Antigravity the final implementation specification.


keep in mind for WebRTC calling feature  we will use LiveKit