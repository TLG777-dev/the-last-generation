import { readFileSync, writeFileSync } from 'fs';

const DATA = JSON.parse(readFileSync('src/data/calendar-data.json', 'utf8'));
const EVENTS = DATA.historicalEvents;

const ENRICHED = {
  "1948-05-14": {
    description: "On May 14, 1948, David Ben-Gurion declared the establishment of the State of Israel, fulfilling the prophetic return described in Ezekiel 37 and Isaiah 66:8. The nation was reborn in a single day after 1,878 years of exile, exactly as foretold. This event triggered the 1948 Arab-Israeli War as five surrounding nations invaded.",
    newsUrl: "https://en.wikipedia.org/wiki/Declaration_of_the_Establishment_of_the_State_of_Israel",
    newsSource: "Wikipedia"
  },
  "1949-04-13": {
    description: "The first blood moon of the 1949-1950 tetrad — four consecutive total lunar eclipses on Passover and Sukkot, a pattern that has occurred only 8 times in 2,000 years. This tetrad coincided with Israel's first years as a nation, marking the beginning of the 'Fig Tree generation' (Matthew 24:32-34).",
    newsUrl: "https://en.wikipedia.org/wiki/Tetrad_(astronomy)",
    newsSource: "Wikipedia"
  },
  "1950-07-05": {
    description: "Israel's Law of Return granted every Jewish person worldwide the legal right to immigrate to Israel and receive citizenship. This law fulfilled the prophetic ingathering of exiles from the four corners of the earth (Isaiah 43:5-6, Ezekiel 36:24).",
    newsUrl: "https://en.wikipedia.org/wiki/Law_of_Return",
    newsSource: "Wikipedia"
  },
  "1967-06-05": {
    description: "In a preemptive strike, Israel defeated Egypt, Jordan, and Syria in six days, recapturing Jerusalem and reuniting the holy city for the first time since 70 AD. The Six-Day War ended with Israel in control of the Temple Mount, the Old City, the West Bank, Gaza, Sinai, and Golan Heights — a territorial transformation that reshaped Middle East prophecy.",
    newsUrl: "https://en.wikipedia.org/wiki/Six-Day_War",
    newsSource: "Wikipedia"
  },
  "1968-04-15": {
    description: "Israel began establishing settlements in the territories captured during the Six-Day War, starting with the Golan Heights and the West Bank. This settlement movement became a central issue in Israeli-Palestinian relations and a focal point of biblical prophecy regarding the Land.",
    newsUrl: "https://en.wikipedia.org/wiki/Israeli_settlement",
    newsSource: "Wikipedia"
  },
  "1973-10-06": {
    description: "Egypt and Syria launched a surprise attack on Yom Kippur, the holiest day in Judaism, catching Israel off guard. The war began on the first day of a new Jubilee cycle (1973-1974), a biblical pattern of restoration and judgment. Israel suffered heavy initial losses but ultimately repelled both armies.",
    newsUrl: "https://en.wikipedia.org/wiki/Yom_Kippur_War",
    newsSource: "Wikipedia"
  },
  "1981-06-07": {
    description: "Israeli fighter jets destroyed Saddam Hussein's Osirak nuclear reactor in a daring preemptive strike near Baghdad, preventing Iraq from developing nuclear weapons. The operation, codenamed Opera, remains one of the most consequential preemptive strikes in modern history.",
    newsUrl: "https://en.wikipedia.org/wiki/Operation_Opera",
    newsSource: "Wikipedia"
  },
  "1986-04-26": {
    description: "The Chernobyl Nuclear Power Plant disaster in Ukraine released catastrophic radioactive material across Europe, becoming the worst nuclear accident in history. Occurring just 2 days after a total lunar eclipse on Passover, the timing spiritually signified judgment and exposure of hidden things (Luke 12:2-3).",
    newsUrl: "https://en.wikipedia.org/wiki/Chernobyl_disaster",
    newsSource: "Wikipedia"
  },
  "1987-12-08": {
    description: "The First Intifada — a sustained Palestinian uprising against Israeli occupation — began in the Gaza Strip and spread to the West Bank. The intifada marked a turning point in the Israeli-Palestinian conflict, leading to the Oslo Accords and the establishment of the Palestinian Authority.",
    newsUrl: "https://en.wikipedia.org/wiki/First_Intifada",
    newsSource: "Wikipedia"
  },
  "1988-08-18": {
    description: "Hamas was founded by Sheikh Ahmed Yassin during the First Intifada as the Islamic Resistance Movement, dedicated to the establishment of an Islamic state in all of historical Palestine. The group's charter calls for the destruction of Israel, making it a key prophetic actor end-times scenarios involving the 'king of the South' (Daniel 11).",
    newsUrl: "https://en.wikipedia.org/wiki/Hamas",
    newsSource: "Wikipedia"
  },
  "1994-10-26": {
    description: "Israel and Jordan signed a historic peace treaty at the Arava border crossing, making Jordan only the second Arab nation to normalize relations with Israel (after Egypt in 1979). The treaty addressed borders, water sharing, security cooperation, and established full diplomatic relations — a fulfillment of Isaiah 19:23-25.",
    newsUrl: "https://en.wikipedia.org/wiki/Israel%E2%80%93Jordan_peace_treaty",
    newsSource: "Wikipedia"
  },
  "1995-11-04": {
    description: "Israeli Prime Minister Yitzhak Rabin was assassinated by a Jewish extremist at a peace rally in Tel Aviv, just 11 days after a partial lunar eclipse on Passover. His death shocked the nation and fundamentally altered the trajectory of the Oslo peace process.",
    newsUrl: "https://en.wikipedia.org/wiki/Assassination_of_Yitzhak_Rabin",
    newsSource: "Wikipedia"
  },
  "1996-05-29": {
    description: "Benjamin Netanyahu was elected Prime Minister of Israel for the first time, defeating Shimon Peres in the first direct election for Prime Minister in Israeli history. Netanyahu's victory came during a year of blood moon tetrad eclipses on Passover and Sukkot.",
    newsUrl: "https://en.wikipedia.org/wiki/1996_Israeli_general_election",
    newsSource: "Wikipedia"
  },
  "2001-09-11": {
    description: "Al-Qaeda terrorists hijacked four commercial airliners and attacked the World Trade Center in New York and the Pentagon, killing 2,977 people. The September 11 attacks triggered the War on Terror and reshaped global geopolitics, with far-reaching consequences for Israel and the Middle East. Earlier that year, a total lunar eclipse (Jan 9) and total solar eclipse (Jun 21) occurred.",
    newsUrl: "https://en.wikipedia.org/wiki/September_11_attacks",
    newsSource: "Wikipedia"
  },
  "2005-08-15": {
    description: "Israel unilaterally disengaged from the Gaza Strip, evacuating all 8,000 Jewish settlers and withdrawing military forces after 38 years of occupation. The disengagement was championed by Ariel Sharon but later led to Hamas taking control of Gaza in 2007, turning it into a launching pad for rocket attacks on Israel.",
    newsUrl: "https://en.wikipedia.org/wiki/Israeli_disengagement_from_Gaza",
    newsSource: "Wikipedia"
  },
  "2006-07-12": {
    description: "Hezbollah launched a cross-border raid from Lebanon, killing and capturing Israeli soldiers, triggering the Second Lebanon War. The 34-day conflict saw Hezbollah fire thousands of rockets into northern Israel, revealing the growing threat of Iran-backed proxies on Israel's borders — earlier on Nisan 1 (Mar 29) a total solar eclipse occurred.",
    newsUrl: "https://en.wikipedia.org/wiki/2006_Lebanon_War",
    newsSource: "Wikipedia"
  },
  "2008-09-15": {
    description: "Lehman Brothers collapsed, triggering the global financial crisis — the worst economic disaster since the Great Depression. Markets crashed worldwide, trillions in wealth were destroyed, and the crisis exposed systemic corruption. Two eclipses occurred earlier in the year: a total solar eclipse (Aug 1) and a partial lunar eclipse (Feb 21).",
    newsUrl: "https://en.wikipedia.org/wiki/Financial_crisis_of_2007%E2%80%932008",
    newsSource: "Wikipedia"
  },
  "2014-04-15": {
    description: "The first blood moon of the 2014-2015 tetrad fell directly on Passover — four consecutive total lunar eclipses on Passover and Sukkot, with solar eclipses on Nisan 1 between them. This tetrad occurred exactly 2,000 years after the first recorded tetrad and was widely discussed in prophecy circles as a potential sign of end-times events.",
    newsUrl: "https://en.wikipedia.org/wiki/2014%E2%80%932015_lunar_eclipse_tetrad",
    newsSource: "Wikipedia"
  },
  "2015-07-14": {
    description: "The Joint Comprehensive Plan of Action (JCPOA) was signed between Iran and world powers, limiting Iran's nuclear program in exchange for sanctions relief. The deal was deeply controversial in Israel, with Netanyahu warning it would enable Iran to develop nuclear weapons within a decade — a direct threat fulfilling prophecies of the 'king of the North' (Daniel 11).",
    newsUrl: "https://en.wikipedia.org/wiki/Joint_Comprehensive_Plan_of_Action",
    newsSource: "Wikipedia"
  },
  "2023-10-07": {
    description: "Hamas launched an unprecedented surprise attack on Israel from Gaza — the deadliest day for Jews since the Holocaust. Over 1,200 Israelis were murdered in coordinated assaults on military bases, kibbutzim, and a music festival. The attack occurred on Shemini Atzeret, the last day of a Jubilee cycle (2023-2024), triggering the largest Israeli military operation in Gaza since 1948.",
    newsUrl: "https://en.wikipedia.org/wiki/2023_Hamas-led_attack_on_Israel",
    newsSource: "Wikipedia"
  },
  "2024-04-08": {
    description: "The Great American Eclipse — a total solar eclipse crossed North America from Mexico to Canada, passing directly over seven US cities named 'Nineveh' and the Ozark Mountains. Occurring on Nisan 1 (the biblical new year), this eclipse was seen as a prophetic sign in the heavens, exactly 7 years after the 2017 Great American Eclipse.",
    newsUrl: "https://en.wikipedia.org/wiki/Solar_eclipse_of_April_8,_2024",
    newsSource: "Wikipedia"
  },
  "2024-04-13": {
    description: "Iran launched over 300 drones, cruise missiles, and ballistic missiles directly at Israel — the first direct Iranian attack on Israel in history. Israel, with help from US, UK, France, and Jordan, successfully intercepted 99% of the projectiles. The attack came just 5 days after the Nisan 1 total solar eclipse, demonstrating a dramatic escalation in the Israel-Iran conflict.",
    newsUrl: "https://en.wikipedia.org/wiki/2024_Iranian_strikes_on_Israel",
    newsSource: "Wikipedia"
  },
  "2026-03-03": {
    description: "A total lunar eclipse falls on Purim — the first Purim lunar eclipse of the 21st century. Purim commemorates the deliverance of the Jewish people from Haman's genocidal plot in Persia. A lunar eclipse on this date symbolizes divine intervention and the humbling of Israel's enemies, recalling Esther's account.",
    newsUrl: "https://en.wikipedia.org/wiki/March_2026_lunar_eclipse",
    newsSource: "Wikipedia"
  },
  "2029-09-11": {
    description: "A shemitah cycle begins on Rosh Hashanah 2029 — the earliest possible start year for the 70th Week of Daniel (Daniel 9:24-27). If the tribulation begins in a shemitah year, this cycle marks the biblical 'seven-year period' of Jacob's Trouble. A partial solar eclipse on Tishrei 1 accompanies this pivotal year.",
    newsUrl: "https://en.wikipedia.org/wiki/Seventy_weeks_of_Daniel",
    newsSource: "Wikipedia"
  },
  "2033-03-30": {
    description: "A total solar eclipse on Nisan 1 followed by a total lunar eclipse on Passover 14 days later — the rarest possible celestial alignment. This double sign in 2033 completes the 2032-2033 tetrad (the Biltz tetrad) and occurs exactly 2,000 years after the crucifixion (traditional dating places the cross at 33 AD). If the 2029-2036 tribulation model holds, this marks the midpoint of the 70th Week (Matthew 24:29-31).",
    newsUrl: "https://en.wikipedia.org/wiki/Solar_eclipse_of_March_30,_2033",
    newsSource: "Wikipedia"
  }
};

for (const ev of EVENTS) {
  const data = ENRICHED[ev.eventDate];
  if (data) {
    ev.description = data.description;
    ev.newsUrl = data.newsUrl;
    ev.newsSource = data.newsSource;
  } else {
    console.log('WARNING: No data for', ev.eventDate, ev.event);
  }
}

writeFileSync('src/data/calendar-data.json', JSON.stringify(DATA, null, 2));
console.log('Done. Enriched', Object.keys(ENRICHED).length, 'events.');
