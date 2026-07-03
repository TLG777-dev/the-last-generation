import https from 'https';
import fs from 'fs';
import path from 'path';

const KJV_URL = 'https://raw.githubusercontent.com/midvash/bible-data/main/versions/en/kjv/kjv.json';
const OUTPUT_DIR = '/home/promeus/Documents/Second-Brain/10-Domains/01-Scripture-Prophecy/raw/scripture/';

const BOOK_META = {
  'Genesis': {
    description: 'Full 50 chapters of Genesis — creation, the fall, the flood, Babel, Abrahamic covenant, patriarchs, Joseph',
    tags: ['creation', 'patriarchs', 'covenant', 'history']
  },
  'Exodus': {
    description: 'Full 40 chapters of Exodus — Moses, the plagues, Passover, the Law, tabernacle, priesthood',
    tags: ['history', 'law', 'moses', 'passover', 'exodus']
  },
  'Leviticus': {
    description: 'Full 27 chapters of Leviticus — the law of sacrifices, priesthood, feasts of the Lord, holiness code, Jubilee',
    tags: ['law', 'priesthood', 'sacrifice', 'feasts', 'jubilee']
  },
  'Numbers': {
    description: 'Full 36 chapters of Numbers — wilderness wandering, census, Balaam, tribal inheritances',
    tags: ['history', 'wilderness', 'moses']
  },
  'Deuteronomy': {
    description: 'Full 34 chapters of Deuteronomy — the second law, covenant renewal, blessings and curses, prophecy of the Prophet',
    tags: ['law', 'covenant', 'moses', 'prophecy']
  },
  'Joshua': {
    description: 'Full 24 chapters of Joshua — conquest of Canaan, dividing the land, covenant at Shechem',
    tags: ['history', 'conquest', 'canaan']
  },
  'Judges': {
    description: 'Full 21 chapters of Judges — the cycle of sin and deliverance, Deborah, Gideon, Samson',
    tags: ['history', 'judges', 'deliverance']
  },
  'Ruth': {
    description: 'Full 4 chapters of Ruth — loyalty, redemption, Boaz as kinsman-redeemer, lineage of David',
    tags: ['history', 'redemption', 'typology']
  },
  '1 Samuel': {
    description: 'Full 31 chapters of 1 Samuel — Samuel the prophet, Saul\'s rise and fall, David anointed',
    tags: ['history', 'kings', 'david', 'prophet']
  },
  '2 Samuel': {
    description: 'Full 24 chapters of 2 Samuel — David\'s reign, Bathsheba, Absalom\'s rebellion, Davidic covenant',
    tags: ['history', 'david', 'covenant', 'kings']
  },
  '1 Kings': {
    description: 'Full 22 chapters of 1 Kings — Solomon\'s temple, division of the kingdom, Elijah the prophet',
    tags: ['history', 'kings', 'temple', 'elijah']
  },
  '2 Kings': {
    description: 'Full 25 chapters of 2 Kings — divided kingdom, Elisha, fall of Israel and Judah, the captivity',
    tags: ['history', 'kings', 'prophecy', 'captivity']
  },
  '1 Chronicles': {
    description: 'Full 29 chapters of 1 Chronicles — genealogies from Adam, David\'s reign, temple preparations',
    tags: ['history', 'genealogy', 'david', 'temple']
  },
  '2 Chronicles': {
    description: 'Full 36 chapters of 2 Chronicles — Solomon\'s temple, kings of Judah, the captivity and decree of Cyrus',
    tags: ['history', 'temple', 'kings', 'captivity']
  },
  'Ezra': {
    description: 'Full 10 chapters of Ezra — return from captivity, rebuilding the temple, restoration',
    tags: ['history', 'restoration', 'temple']
  },
  'Nehemiah': {
    description: 'Full 13 chapters of Nehemiah — rebuilding Jerusalem\'s walls, covenant renewal, revival',
    tags: ['history', 'restoration', 'jerusalem']
  },
  'Esther': {
    description: 'Full 10 chapters of Esther — Purim, God\'s providence, deliverance of the Jews in Persia',
    tags: ['history', 'providence', 'purim']
  },
  'Job': {
    description: 'Full 42 chapters of Job — suffering, theodicy, redemption, God\'s sovereignty',
    tags: ['wisdom', 'suffering', 'poetry']
  },
  'Psalms': {
    description: 'All 150 Psalms — Israel\'s songbook, messianic prophecies, imprecatory prayers, end-times imagery, Davidic covenant',
    tags: ['poetry', 'worship', 'messianic', 'prophecy']
  },
  'Proverbs': {
    description: 'Full 31 chapters of Proverbs — wisdom literature, Solomon, the fear of the Lord',
    tags: ['wisdom', 'poetry']
  },
  'Ecclesiastes': {
    description: 'Full 12 chapters of Ecclesiastes — vanity of life under the sun, the whole duty of man',
    tags: ['wisdom', 'poetry']
  },
  'Song of Solomon': {
    description: 'Full 8 chapters of the Song of Solomon — typology of Christ and the Church, marital love',
    tags: ['poetry', 'typology']
  },
  'Isaiah': {
    description: 'Full 66 chapters of Isaiah — messianic prophecies, the virgin birth, end-times visions, new heavens and new earth',
    tags: ['prophecy', 'major-prophets', 'messianic', 'end-times']
  },
  'Jeremiah': {
    description: 'Full 52 chapters of Jeremiah — the weeping prophet, Judah\'s judgment, the new covenant prophecy, 70 years captivity',
    tags: ['prophecy', 'major-prophets', 'captivity', 'covenant']
  },
  'Lamentations': {
    description: 'Full 5 chapters of Lamentations — Jeremiah\'s lament over fallen Jerusalem, divine judgment',
    tags: ['poetry', 'prophecy', 'judgment', 'jerusalem']
  },
  'Ezekiel': {
    description: 'Full 48 chapters of Ezekiel — visions of God\'s glory, dry bones, Gog and Magog, millennial temple',
    tags: ['prophecy', 'major-prophets', 'end-times', 'temple', 'gog-magog']
  },
  'Daniel': {
    description: 'Full 12 chapters of Daniel — Nebuchadnezzar\'s dream, 70 weeks prophecy, son of man, end-times timeline',
    tags: ['prophecy', 'major-prophets', 'end-times', '70-weeks']
  },
  'Hosea': {
    description: 'Full 14 chapters of Hosea — God\'s marriage metaphor, Israel\'s unfaithfulness, restoration prophecy',
    tags: ['prophecy', 'minor-prophets', 'restoration']
  },
  'Joel': {
    description: 'Full 3 chapters of Joel — the locust army, outpouring of the Spirit, day of the Lord, blood moon prophecy',
    tags: ['prophecy', 'minor-prophets', 'end-times', 'day-of-the-lord']
  },
  'Amos': {
    description: 'Full 9 chapters of Amos — judgment on the nations, the plumb line, the restored tabernacle of David',
    tags: ['prophecy', 'minor-prophets', 'judgment', 'restoration']
  },
  'Obadiah': {
    description: 'Full 1 chapter of Obadiah — judgment on Edom, the day of the Lord, deliverance on Mount Zion',
    tags: ['prophecy', 'minor-prophets', 'judgment', 'day-of-the-lord']
  },
  'Jonah': {
    description: 'Full 4 chapters of Jonah — the sign of Jonah, Nineveh\'s repentance, God\'s mercy to the nations',
    tags: ['prophecy', 'minor-prophets', 'typology', 'repentance']
  },
  'Micah': {
    description: 'Full 7 chapters of Micah — Bethlehem prophecy, what the Lord requires, the remnant, the mountain of the Lord',
    tags: ['prophecy', 'minor-prophets', 'messianic', 'remnant']
  },
  'Nahum': {
    description: 'Full 3 chapters of Nahum — judgment on Nineveh, the vengeance of God',
    tags: ['prophecy', 'minor-prophets', 'judgment']
  },
  'Habakkuk': {
    description: 'Full 3 chapters of Habakkuk — the just shall live by faith, the Chaldean judgment, God\'s sovereignty',
    tags: ['prophecy', 'minor-prophets', 'faith']
  },
  'Zephaniah': {
    description: 'Full 3 chapters of Zephaniah — the great day of the Lord, judgment on Judah and the nations, restoration',
    tags: ['prophecy', 'minor-prophets', 'day-of-the-lord', 'judgment']
  },
  'Haggai': {
    description: 'Full 2 chapters of Haggai — rebuild the temple, the latter glory, the shaking of the nations',
    tags: ['prophecy', 'minor-prophets', 'temple']
  },
  'Zechariah': {
    description: 'Full 14 chapters of Zechariah — visions of the restoration, the Branch, the coming King, end-times Jerusalem',
    tags: ['prophecy', 'minor-prophets', 'end-times', 'messianic', 'jerusalem']
  },
  'Malachi': {
    description: 'Full 4 chapters of Malachi — tithes and offerings, the messenger, the sun of righteousness, Elijah\'s coming',
    tags: ['prophecy', 'minor-prophets', 'messianic', 'elijah']
  },
  'Matthew': {
    description: 'Full 28 chapters of Matthew — the King and His kingdom, fulfillment of prophecy, Olivet Discourse, the Great Commission',
    tags: ['gospel', 'end-times', 'kingdom', 'olivet-discourse']
  },
  'Mark': {
    description: 'Full 16 chapters of Mark — the suffering Servant, the Gospel to the Gentiles, the Olivet Discourse',
    tags: ['gospel', 'end-times', 'olivet-discourse']
  },
  'Luke': {
    description: 'Full 24 chapters of Luke — the Son of Man, the nativity, parables of mercy, the Great Commission, the Ascension',
    tags: ['gospel', 'history']
  },
  'John': {
    description: 'Full 21 chapters of John — the deity of Christ, I AM statements, the upper room discourse, the Revelation',
    tags: ['gospel', 'theology']
  },
  'Acts': {
    description: 'Full 28 chapters of Acts — the birth of the Church, Pentecost, the apostolic missions, the Holy Spirit',
    tags: ['history', 'church', 'holy-spirit']
  },
  'Romans': {
    description: 'Full 16 chapters of Romans — justification by faith, Israel\'s future, the fullness of the Gentiles',
    tags: ['epistle', 'paul', 'doctrine', 'israel']
  },
  '1 Corinthians': {
    description: 'Full 16 chapters of 1 Corinthians — the Resurrection, spiritual gifts, the Body of Christ, the Lord\'s Supper',
    tags: ['epistle', 'paul', 'doctrine', 'resurrection']
  },
  '2 Corinthians': {
    description: 'Full 13 chapters of 2 Corinthians — the ministry of reconciliation, the New Covenant, Paul\'s apostolic authority',
    tags: ['epistle', 'paul', 'doctrine']
  },
  'Galatians': {
    description: 'Full 6 chapters of Galatians — grace vs law, the fruit of the Spirit, freedom in Christ',
    tags: ['epistle', 'paul', 'doctrine', 'grace']
  },
  'Ephesians': {
    description: 'Full 6 chapters of Ephesians — the mystery of Christ, the Body, spiritual warfare, the armor of God',
    tags: ['epistle', 'paul', 'doctrine', 'spiritual-warfare']
  },
  'Philippians': {
    description: 'Full 4 chapters of Philippians — joy in suffering, the mind of Christ, the kenosis passage',
    tags: ['epistle', 'paul', 'joy']
  },
  'Colossians': {
    description: 'Full 4 chapters of Colossians — the supremacy of Christ, the mystery of God, warnings against false doctrine',
    tags: ['epistle', 'paul', 'doctrine']
  },
  '1 Thessalonians': {
    description: 'Full 5 chapters of 1 Thessalonians — the rapture, the day of the Lord, the man of sin, the resurrection',
    tags: ['epistle', 'paul', 'end-times', 'rapture']
  },
  '2 Thessalonians': {
    description: 'Full 3 chapters of 2 Thessalonians — the man of sin revealed, the falling away, the coming of Christ',
    tags: ['epistle', 'paul', 'end-times', 'man-of-sin']
  },
  '1 Timothy': {
    description: 'Full 6 chapters of 1 Timothy — church order, qualifications of elders, the latter times apostasy',
    tags: ['epistle', 'paul', 'church', 'end-times']
  },
  '2 Timothy': {
    description: 'Full 4 chapters of 2 Timothy — Paul\'s final words, the last days, Scripture\'s sufficiency, the crown of righteousness',
    tags: ['epistle', 'paul', 'last-days', 'scripture']
  },
  'Titus': {
    description: 'Full 3 chapters of Titus — sound doctrine, church leadership, the grace of God, the blessed hope',
    tags: ['epistle', 'paul', 'church']
  },
  'Philemon': {
    description: 'Full 1 chapter of Philemon — forgiveness, Onesimus, Christian brotherhood',
    tags: ['epistle', 'paul']
  },
  'Hebrews': {
    description: 'Full 13 chapters of Hebrews — Christ as High Priest, the New Covenant, faith\'s hall of fame, the warning passages',
    tags: ['epistle', 'doctrine', 'typology', 'covenant']
  },
  'James': {
    description: 'Full 5 chapters of James — faith without works, the tongue, the prayer of faith, the coming of the Lord',
    tags: ['epistle', 'doctrine', 'end-times']
  },
  '1 Peter': {
    description: 'Full 5 chapters of 1 Peter — suffering for Christ, the spiritual house, the end of all things is at hand',
    tags: ['epistle', 'peter', 'end-times', 'suffering']
  },
  '2 Peter': {
    description: 'Full 3 chapters of 2 Peter — the day of the Lord, false prophets, the elements melt with fervent heat',
    tags: ['epistle', 'peter', 'end-times', 'day-of-the-lord']
  },
  '1 John': {
    description: 'Full 5 chapters of 1 John — fellowship with God, love and truth, the spirit of antichrist, the last hour',
    tags: ['epistle', 'john', 'end-times', 'antichrist']
  },
  '2 John': {
    description: 'Full 1 chapter of 2 John — truth and love, warning against deceivers, the antichrist',
    tags: ['epistle', 'john', 'antichrist']
  },
  '3 John': {
    description: 'Full 1 chapter of 3 John — walking in truth, hospitality, Diotrephes the troublemaker',
    tags: ['epistle', 'john']
  },
  'Jude': {
    description: 'Full 1 chapter of Jude — contend for the faith, judgment on apostates, Enoch\'s prophecy, the coming of the Lord',
    tags: ['epistle', 'jude', 'end-times', 'prophecy']
  },
  'Revelation': {
    description: 'All 22 chapters of Revelation — the seven churches, seals, trumpets, vials, the Beast, Armageddon, the New Jerusalem',
    tags: ['prophecy', 'end-times', 'apocalyptic', 'revelation']
  }
};

function slugify(name) {
  let s = name.toLowerCase();
  s = s.replace(/[^a-z0-9]+/g, '-');
  s = s.replace(/^-|-$/g, '');
  return s;
}

function getFileName(bookId, name) {
  const num = String(bookId).padStart(2, '0');
  const slug = slugify(name);
  return `${num}-${slug}-kjv.md`;
}

function getTestament(testamentCode) {
  return testamentCode === 'OT' ? 'old-testament' : 'new-testament';
}

function buildFrontmatter(bookName, bookData) {
  const meta = BOOK_META[bookName] || {
    description: `Full ${bookData.chapters.length} chapters of the Book of ${bookName}, King James Version`,
    tags: []
  };
  const testament = getTestament(bookData.testament);
  const chapterCount = bookData.chapters.length;
  const baseTags = ['scripture', 'kjv', 'bible', slugify(bookName), testament];
  const allTags = [...new Set([...baseTags, ...meta.tags])];
  return `---
title: "The Book of ${bookName} (KJV)"
author: "Holy Bible (KJV)"
source_type: "scripture"
description: "${meta.description}"
tags: [${allTags.map(t => t.toLowerCase()).join(', ')}]
status: "reference"
---`;
}

function buildContent(bookName, chapters) {
  const lines = [`# The Book of ${bookName} (KJV)`];
  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    lines.push(`\n## Chapter ${ch.chapter}`);
    for (const v of ch.verses) {
      lines.push(`\n${v.number}. ${v.text}`);
    }
  }
  return lines.join('');
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('Downloading KJV JSON...');
  const bible = await fetchJSON(KJV_URL);

  const books = bible.books;
  console.log(`Loaded ${books.length} books.`);

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const book of books) {
    const name = book.englishName;
    const id = book.bookId;
    const fileName = getFileName(id, name);
    const filePath = path.join(OUTPUT_DIR, fileName);

    const frontmatter = buildFrontmatter(name, book);
    const content = buildContent(name, book.chapters);
    const fullContent = frontmatter + '\n\n' + content + '\n';

    fs.writeFileSync(filePath, fullContent, 'utf-8');
    console.log(`  [${String(id).padStart(2, '0')}/66] ${name} -> ${fileName}`);
  }

  console.log('\nDone. All 66 books imported.');
  console.log(`Output: ${OUTPUT_DIR}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
