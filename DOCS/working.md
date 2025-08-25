<!-- Docs/working.md -->
# API Workflow & Integration with High Court Website

This document explains how the API interacts with the Allahabad High Court website, fetches case details, and updates registered users via WhatsApp.

---

## 1. Data Fetching
- The API periodically sends **HTTP requests** to the official Allahabad High Court case status portal.
- Required inputs (case number, year, party name, etc.) are passed in the request.
- The response is parsed (HTML/JSON) and normalized into a structured format.

---

## 2. Data Processing
- Extracted fields (case number, petitioner/respondent names, next hearing date, status, judge bench, etc.) are cleaned and stored.
- If there are **new updates** (e.g., listing, adjournment, bail order), the system flags them for notification.

---

## 3. Database Management
- Each registered user is mapped to their **case ID(s)** in the database.
- Updates are **logged with timestamps**, ensuring a history of notifications is maintained.
- Duplicate or unchanged case statuses are ignored to avoid spamming.

---

## 4. WhatsApp Notification System
- The API integrates with WhatsApp Business API (or Twilio/Meta Graph API) for automated messaging.
- When a case update is detected:
  - A message is composed with the case number, update summary, and next hearing date.
  - The user receives the update on their registered WhatsApp number in real-time.
- Delivery receipts are tracked to ensure users actually receive the notifications.

---

## 5. Cron Jobs / Scheduling
- Background **cron jobs** trigger the API calls at fixed intervals (e.g., every morning at 7 AM and evening at 7 PM).
- Urgent updates (like sudden listing changes) can trigger **immediate push notifications**.

---

## 6. Error Handling
- If the High Court website is down, the API retries with exponential backoff.
- Any failed WhatsApp delivery attempts are logged and retried.
- Users are notified only when **confirmed, valid updates** are available.

---

## 7. Security & Privacy
- All user data (mobile number, case IDs) is stored in encrypted form.
- No case data is shared with third parties.
- Only minimal necessary fields are fetched and sent.

---

## 8. Future Enhancements
- Multi-court integration (other High Courts / Supreme Court).
- PDF judgment scraping and direct WhatsApp delivery.
- AI-based case prediction & alerting system.
