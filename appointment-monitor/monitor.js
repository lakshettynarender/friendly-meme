import { chromium } from "playwright";

const URL = "https://denhaag.mijnafspraakmaken.nl/?product=25";
const START_DATE = "2027-01-25";
const END_DATE = "2027-04-15";
const topic = process.env.NTFY_TOPIC;

if (!topic) {
  throw new Error("NTFY_TOPIC repository secret is not configured.");
}

function parseDutchDate(text) {
  const match = text.match(/(?:maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag),?\s+(\d{1,2})\s+([a-z]+)\s+(20\d{2})/i);
  if (!match) return null;

  const months = {
    januari: 1, februari: 2, maart: 3, april: 4, mei: 5, juni: 6,
    juli: 7, augustus: 8, september: 9, oktober: 10, november: 11, december: 12
  };
  const month = months[match[2].toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ locale: "nl-NL" });
  const page = await context.newPage();
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("button", { name: "Volgende stap" }).click();
  await page.getByRole("textbox", { name: "Dag" }).waitFor({ timeout: 45_000 });

  const bodyText = await page.locator("body").innerText();
  const dateValue = parseDutchDate(bodyText);

  if (!dateValue) {
    throw new Error("Could not read an available date.");
  }

  if (dateValue >= START_DATE && dateValue <= END_DATE) {
    const message = `Available date ${dateValue} is within ${START_DATE} to ${END_DATE}. Open ${URL}`;
    const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        Title: "Den Haag appointment slot available",
        Priority: "high",
        Tags: "calendar,bell"
      },
      body: message
    });
    if (!response.ok) throw new Error(`Push notification failed: HTTP ${response.status}`);
    console.log(message);
  } else {
    console.log(`No matching date. Earliest date shown: ${dateValue}.`);
  }
} finally {
  await browser.close();
}
