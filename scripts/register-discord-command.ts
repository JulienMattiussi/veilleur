#!/usr/bin/env npx tsx

async function main() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!applicationId || !botToken) {
    console.error("Missing DISCORD_APPLICATION_ID or DISCORD_BOT_TOKEN");
    process.exit(1);
  }

  const veille = {
    name: "veille",
    description: "Extrait et synthétise les liens partagés dans un canal sur une période donnée",
    integration_types: [0], // 0 = GUILD_INSTALL
    contexts: [0], // 0 = GUILD - commande disponible uniquement dans les serveurs
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

  const stats = {
    name: "stats",
    description: "Compte et liste les messages d'un canal sur une période, par auteur ou par terme",
    integration_types: [0],
    contexts: [0],
    options: [
      {
        type: 7, // CHANNEL
        name: "canal",
        description: "Le canal Discord à parcourir",
        required: true,
      },
      {
        type: 3, // STRING
        name: "début",
        description: "Date de début (JJ/MM/AAAA ou AAAA-MM-JJ), par défaut 30 jours avant la fin",
        required: false,
      },
      {
        type: 3, // STRING
        name: "fin",
        description: "Date de fin incluse (JJ/MM/AAAA ou AAAA-MM-JJ), par défaut aujourd'hui",
        required: false,
      },
      {
        type: 6, // USER
        name: "auteur",
        description: "Ne garder que les messages de ce membre",
        required: false,
      },
      {
        type: 3, // STRING
        name: "terme",
        description: "Ne garder que les messages contenant ce terme (casse ignorée)",
        required: false,
      },
    ],
  };

  const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

  // PUT overwrites the whole command set: every command of the bot must be listed here.
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([veille, stats]),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Failed to register commands:", err);
    process.exit(1);
  }

  console.log("Commands /veille and /stats registered successfully.");
  console.log(await res.json());
}

main();
