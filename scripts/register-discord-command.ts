#!/usr/bin/env npx tsx

const applicationId = process.env.DISCORD_APPLICATION_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!applicationId || !botToken) {
  console.error("Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN");
  process.exit(1);
}

const command = {
  name: "veille",
  description: "Extrait et synthétise les liens partagés dans un canal sur une période donnée",
  options: [
    {
      type: 7, // CHANNEL
      name: "canal",
      description: "Le canal Discord à parcourir",
      required: true,
    },
    {
      type: 3, // STRING
      name: "période",
      description: "Période à parcourir (ex: 1j, 7j, 30j)",
      required: false,
      choices: [
        { name: "Hier (1 jour)", value: "1j" },
        { name: "Cette semaine (7 jours)", value: "7j" },
        { name: "Ce mois (30 jours)", value: "30j" },
      ],
    },
  ],
};

const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(command),
});

if (!res.ok) {
  const err = await res.text();
  console.error("Failed to register command:", err);
  process.exit(1);
}

console.log("Command /veille registered successfully.");
console.log(await res.json());
