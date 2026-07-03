(function(){
  'use strict';

  const YEAR_START = 2010, YEAR_END = 2040;
  const PX_YEAR = 72;      // matches --cv-px-year in CSS
  const LANE_H = 52;       // matches --cv-lane-h
  const NOW = 2026.5;      // mid-2026

  // ─── Data ───
  const teachers = [
    {
      id:'amir-tsarfati', name:'Amir Tsarfati', method:'Israel Current Events', role:'Bible Teacher',
      color:'#1B6B8A', tag:'On the Ground',
      detail:'Israeli-born founder of Behold Israel (700K+ YouTube). Former deputy gov of Jericho. Sees Ezekiel 38 coalition forming now. Trump = last pro-Israel US president.',
      events:[
        {year:2018, label:'Generation window', status:'marker', span:{start:2018,end:2028}, desc:'The 40-year fig tree generation (Matt 24:32-34) extended by Psalm 90:10 to 80 years, placing the end within this window.'},
        {year:2023, label:'Oct 7 attack ✓', status:'fulfilled', desc:'Confirmed his warnings that Israel\'s southern border was exposed to multi-front attack from Gaza, Hezbollah, Iran.'},
        {year:2024, label:'Trump last pro-Israel?', status:'pending', desc:'If Trump is the final pro-Israel US president, America\'s role shifts and Ezekiel 38 coalition moves forward.'},
        {year:2026, label:'Ezekiel 38 forming', status:'pending', desc:'Russia-Iran-Turkey axis tightening. Tsarfati sees the Ezekiel 38 coalition as the next major prophetic milestone.'},
      ]
    },
    {
      id:'joel-rosenberg', name:'Joel C. Rosenberg', method:'Geopolitics + Prophecy', role:'Author / Analyst',
      color:'#1B5E3C', tag:'Proven Track Record',
      detail:'NYT bestselling author. Predicted Russia-Iran alliance (2005) same day Ahmadinejad elected. Tracks Jeremiah 49 (Iran regime collapse). Lives in Jerusalem.',
      events:[
        {year:2005, label:'Ezekiel Option ✓', status:'fulfilled', pinned:true, desc:'Predicted Russia-Iran military alliance the same day Ahmadinejad won. Fulfilled through Syrian war and now Ukraine.'},
        {year:2018, label:'Generation window', status:'marker', span:{start:2018,end:2028}, desc:'1948 fig tree generation. Rosenberg expects major Middle East realignment before this window closes.'},
        {year:2023, label:'Oct 7 attack ✓', status:'fulfilled', desc:'Accelerated his timeline for regional war. Iran\'s proxy forces now directly engaged with Israel.'},
        {year:2025, label:'Jeremiah 49 beginning?', status:'pending', span:{start:2025,end:2027}, desc:'Jeremiah 49 prophecies against Damascus (Syria) and Kedar (Saudi Arabia/Iran). Regime collapse expected.'},
        {year:2026, label:'Iran regime shaking', status:'pending', desc:'Internal Iranian collapse from economic pressure. Connected to Jeremiah 49:38 — Elam\'s throne destroyed.'},
      ]
    },
    {
      id:'derek-prince', name:'Derek Prince', method:'Fig Tree', role:'Bible Scholar',
      color:'#4A6FA5', tag:'Scriptural',
      detail:'1915–2003. Eyewitness to Israel\'s rebirth. The fig tree generation (Matt 24) defines our season.',
      events:[
        {year:1948, label:'Israel reborn ✓', status:'fulfilled', pinned:true, desc:'The fig tree budded (Matt 24:32-34). Foundation of the generation clock — this generation shall not pass until all is fulfilled.'},
        {year:1967, label:'Jerusalem unified ✓', status:'fulfilled', pinned:true, desc:'"Times of the Gentiles" fulfilled (Luke 21:24). Jerusalem under Jewish control sets the stage for the final act.'},
        {year:2018, label:'Generation window', status:'marker', span:{start:2018,end:2028}, desc:'A biblical generation = 70-80 years (Ps 90:10). If 1948 starts the clock, the return is within this window.'},
      ]
    },
    {
      id:'mark-biltz', name:'Mark Biltz', method:'Shemitah + Astronomy', role:'Pastor',
      color:'#D4AF37', tag:'Calendar',
      detail:'Founder of El Shaddai Ministries. Discovered blood moon tetrads align with shemitah years. Points to 2029 as a key threshold.',
      events:[
        {year:2014, label:'Shemitah begins', status:'marker', span:{start:2014,end:2015}, desc:'The shemitah (7-year) cycle. God\'s appointed time for economic shaking and national judgment (Deut 15).'},
        {year:2015, label:'Shemitah crash ✓', status:'fulfilled', desc:'Stock market correction during the shemitah year. Repeating pattern of economic shaking tied to Israel\'s calendar.'},
        {year:2017, label:'Rev 12 sign ✓', status:'fulfilled', desc:'Virgo + Jupiter (41-week gestation) + moon at feet + Leo crown (9 stars + 3 planets) = the exact sign John described. Time-of-the-end unlocking.'},
        {year:2017, label:'Great American Eclipse ✓', status:'fulfilled', desc:'Total solar eclipse crossing America coast-to-coast. A warning sign over the nation in a shemitah year.'},
        {year:2021, label:'Shemitah begins', status:'marker', span:{start:2021,end:2022}, desc:'Next shemitah cycle. Follows the 7-year pattern established in 2014 and 2007.'},
        {year:2023, label:'Annular eclipse (Aleph-Tav) ✓', status:'fulfilled', desc:'Annular eclipse crossing America. Combined with 2017 and 2024 eclipses to form the Aleph-Tav (X) over the nation.'},
        {year:2024, label:'Great American Eclipse II ✓', status:'fulfilled', desc:'Second total solar eclipse in 7 years, completing the Tav (cross) mark. Paired with 2017 eclipse over America.'},
        {year:2026, label:'Nasso / Trib window?', status:'pending', desc:'His Nasso 5786 Torah portion teaching suggests tribulation could begin 3.5 years from May 2026.'},
        {year:2029, label:'70th Shemitah?', status:'pending', desc:'If 2029 is the 70th shemitah from 1948, it marks 80 years — a full generation — for Israel\'s season of visitation.'},
        {year:2033, label:'Blood moon / Return?', status:'pending', desc:'Blood moon tetrads align with shemitah patterns. 2033 = 2,000 years from the crucifixion — a potential return window.'},
      ]
    },
    {
      id:'jonathan-cahn', name:'Jonathan Cahn', method:'Jubilee + Shemitah Cycles', role:'Pastor',
      color:'#B8860B', tag:'Pattern',
      detail:'Author of The Harbinger, The Mystery of the Shemitah. Documents God\'s 7-year shemitah and 50-year jubilee patterns in world events.',
      events:[
        {year:2001, label:'Shemitah crash (9/11) ✓', status:'fulfilled', desc:'9/11 attacks occurred in a shemitah year. Harp of God judgment pattern — America\'s 9/11 = Israel\'s 9th of Av.'},
        {year:2008, label:'Shemitah crash ✓', status:'fulfilled', desc:'The 2008 financial collapse occurred in a shemitah year. The judgment cycle repeats with precision across decades.'},
        {year:2015, label:'Shemitah crash ✓', status:'fulfilled', desc:'Stock correction during the shemitah year. Third consecutive shemitah pattern fulfilled in the 21st century.'},
        {year:2017, label:'Jubilee (1917→1967→2017) ✓', status:'fulfilled', desc:'50-year cycles from Balfour Declaration (1917) to Jerusalem unification (1967) to the end-times threshold (2017).'},
        {year:2017, label:'Great American Eclipse ✓', status:'fulfilled', desc:'The eclipse was a harbinger in his framework — a warning sign to America in the jubilee year.'},
        {year:2029, label:'6,000-year threshold', status:'pending', desc:'Year 6000 on Hebrew calendar approaches (from creation ~3761 BC). The 7th millennium represents God\'s sabbath rest.'},
      ]
    },
    {
      id:'steve-cioccolanti', name:'Steve Cioccolanti', method:'Revelation 6 + Feasts', role:'Pastor',
      color:'#6B3FA0', tag:'Scriptural',
      detail:'Discovered the 7 feasts map to the 7 seals of Revelation 6. White horse = 2020–2023 (fulfilled). Red horse is now. Sees rapture before 4th seal.',
      events:[
        {year:2020, label:'White Horse (COVID) ✓', status:'fulfilled', span:{start:2020,end:2023}, desc:'The White Horse of Rev 6 = global plague/commerce disruption. COVID fulfilled this seal exactly as he taught.'},
        {year:2022, label:'Ukraine war (Red Horse) ✓', status:'fulfilled', desc:'The Red Horse (war) follows the White Horse. Ukraine invasion fulfilled the second seal in his feast-based framework.'},
        {year:2023, label:'Oct 7 Israel war ✓', status:'fulfilled', desc:'Further escalation of the Red Horse seal. Israel-Hamas war adds global conflict dimension to the unfolding seals.'},
        {year:2026, label:'Tribulation window?', status:'pending', desc:'His feast-to-seal mapping suggests the final seals accelerate. Rapture expected before the 4th seal (Death).'},
        {year:2033, label:'Return window?', status:'pending', desc:'Based on Daniel\'s 70 weeks and feast patterns. 2033 = 2,000 years from the cross, aligning with other teachers.'},
      ]
    },
    {
      id:'kim-clement', name:'Kim Clement', method:'Prophetic Visions', role:'Prophetic Voice',
      color:'#3A6A9A', tag:'Prophetic',
      detail:'1946–2016. Prophetic track record includes White House table (2010), Iran shaking, and the 2027 Suleiman Decree window.',
      events:[
        {year:2010, label:'White House table ✓', status:'fulfilled', desc:'Prophetic word about a table set in the White House and a \'Trump\' figure rising. Dramatically fulfilled by Trump\'s 2016 election.'},
        {year:2016, label:'Passed away', status:'marker', desc:'Kim Clement passed from this life November 2016. His prophetic words continue to be tracked by the watchman community.'},
        {year:2027, label:'Suleiman Decree?', status:'pending', desc:'Prophetic word about a decree connected to the temple mount and a leader named Suleiman. Tracked by Brandon Biggs.'},
        {year:2028, label:'Iran shaking?', status:'pending', desc:'Prophetic word about a major shaking or regime change in Iran. Connected to the Jeremiah 49 timeline.'},
      ]
    },
    {
      id:'randy-nettles', name:'Randy Nettles', method:'Daniel 70 Sevens + Astronomy', role:'Researcher',
      color:'#3A9A5C', tag:'Mathematical',
      detail:'Daniel\'s 70 weeks = 70 shemitah cycles of 7 years each. His calculations favor 2026–2033 as the 70th week, with 2033 for Christ\'s return.',
      events:[
        {year:2017, label:'Rev 12 sign ✓', status:'fulfilled', desc:'The celestial sign confirms we are in the prophesied season. Matches his mathematical reading of Daniel\'s 70 sevens.'},
        {year:2026, label:'70th week starts?', status:'pending', desc:'Daniel\'s 70th week interpreted as 70 shemitah cycles. His calculations favor 2026 as the starting point.'},
        {year:2033, label:'Return after 70th week', status:'pending', desc:'7 years from 2026 = 2033. Matches the 2,000-year window from the cross and other teachers\' projected return.'},
      ]
    },
    {
      id:'brandon-biggs', name:'Brandon Biggs', method:'Watchman Visions', role:'Watchman',
      color:'#A03030', tag:'Watchman',
      detail:'Modern watchman with verified track record: Trump ear shot (July 2024), 2024 election, crypto strategic reserve, Oct 7 prediction — 5+ fulfilled. His 325 transcripts reveal convergence on 2029 wormwood and Ezekiel 38.',
      events:[
        {year:2023, label:'Oct 7 surprise ✓', status:'fulfilled', desc:'Angel visitation in 2022 gave a 569-day countdown to "great judgment." Calculated to Oct 2, 2023 — Hamas struck Oct 7. A specific time-bound prediction fulfilled.'},
        {year:2024, label:'Trump ear shot ✓', status:'fulfilled', desc:'Prophetic vision of a wounded leader — "ear shot." Fulfilled July 13, 2024 when a bullet grazed Trump\'s ear. Verified track record.'},
        {year:2024, label:'Trump win ✓', status:'fulfilled', desc:'Predicted Trump\'s 2024 victory before it happened. Multiple watchman visions pointed to this outcome.'},
        {year:2024, label:'Crypto reserve ✓', status:'fulfilled', desc:'Prophetic word about a US strategic crypto reserve with 5 specific coins. Fulfilled by Trump\'s 2025 executive order.'},
        {year:2026, label:'Second pandemic?', status:'pending', desc:'Watchman vision of a second global health crisis worse than COVID. 350 million dead seen. Would follow judgment pattern.'},
        {year:2025, label:'Ezekiel 38 forming', status:'pending', span:{start:2025,end:2027}, desc:'Vision of Russia striking Poland, Turkey+Iran joining, then coming against Israel. "Great betrayal" — America does not help Israel. Aligns with Tsarfati/Rosenberg.'},
        {year:2029, label:'Wormwood / Apophis?', status:'pending', desc:'Vision of massive asteroid hitting Atlantic near Puerto Rico. US laser splits it but half still hits. Mega-tsunami across Atlantic. Identified as Apophis 2029. Aligns with Tom Horn and Perry Stone.'},
      ]
    },
    {
      id:'perry-stone', name:'Perry Stone', method:'Blood Moons + Eclipses', role:'Evangelist',
      color:'#C07030', tag:'Calendar',
      detail:'Founder of Voice of Evangelism. 40+ years of documented prophecy ministry. Identified the Aleph-Tav eclipse pattern over America (2017–2024) and tracks Apophis 2029 as a prophetic marker.',
      events:[
        {year:2017, label:'Aleph-Tav eclipse ✓', status:'fulfilled', desc:'First of three American eclipses. A sign of God\'s watchfulness over America — the first stroke of the Tav.'},
        {year:2023, label:'Annular eclipse ✓', status:'fulfilled', desc:'The "ring of fire" eclipse crossed the American Southwest. Middle stroke of the Aleph-Tav pattern.'},
        {year:2024, label:'Aleph-Tav eclipse ✓', status:'fulfilled', desc:'Final eclipse completing the Tav (cross) over America. Combined with 2017 and 2023, it forms God\'s signature mark.'},
        {year:2029, label:'Apophis near-miss', status:'pending', desc:'Asteroid Apophis passes ~19,000 miles from Earth on April 13, 2029. Perry Stone identifies this as a prophetic sign.'},
      ]
    },
    {
      id:'tom-horn', name:'Tom Horn', method:'End-Times Research', role:'Author',
      color:'#2E6B6B', tag:'Researcher',
      detail:'Author of Apophis 2029 and Petrus Romanus. Tracks the convergence of astronomy, technology, and end-times prophecy. Identifies April 13, 2029 as a prophetic marker.',
      events:[
        {year:2017, label:'Rev 12 sign ✓', status:'fulfilled', desc:'Confirms the prophetic season. Horn\'s research connects celestial events to the end-times chronology.'},
        {year:2024, label:'Aleph-Tav eclipse ✓', status:'fulfilled', desc:'The US eclipse cross completes. In Horn\'s framework, this marks a warning of judgment over the nation.'},
        {year:2029, label:'Apophis 2029', status:'pending', desc:'April 13, 2029 near-miss. Could mark the tribulation start or serve as a divine sign — "Wormwood" precursor.'},
      ]
    }
  ];

  const frameworkTeachers = [
    {name:'Chuck Missler', method:'Daniel 9 math', desc:'173,880 days calculation; pre-trib'},
    {name:'Arnold Fruchtenbaum', method:'Systematic theology', desc:'Footsteps of the Messiah; pre-trib'},
    {name:'John McTernan', method:'America/Israel cycles', desc:'Rev 12 sign 2017; judgment patterns'},
    {name:'Tim LaHaye / Thomas Ice', method:'Pre-trib research', desc:'Left Behind; Pre-Trib Research Center'},
    {name:'Jack Hibbs', method:'Current events', desc:'Rev 6 seals unfolding; pre-trib'},
    {name:'David Jeremiah', method:'Biblical prophecy', desc:'The Great Disappearance; season not date'},
    {name:'Paul Begley / Troy Anderson', method:'Signs + current events', desc:'Revelation 911; 2017-2024 eclipse X'},
    {name:'Jan Markell', method:'Israel + Current Events', desc:'Olive Tree Ministries; tracks prophetic alignment'},
    {name:'J.D. Farag', method:'Prophecy updates', desc:'Calvary Chapel; pre-trib; current events'},
    {name:'Hal Lindsey', method:'Fig Tree Generation', desc:'Late Great Planet Earth; 1948 generation'},
  ];

  // ─── Render year headers ───
  function renderYears(){
    const row = document.getElementById('cvYearRow');
    const totalYears = YEAR_END - YEAR_START;
    row.style.width = totalYears * PX_YEAR + 'px';
    for(let y = YEAR_START; y <= YEAR_END; y++){
      const div = document.createElement('div');
      div.className = 'cv-tl-year' + (y % 5 === 0 ? ' cv-tl-year-major' : '');
      div.textContent = y;
      row.appendChild(div);
    }
  }

  // ─── Data-driven column ranges ───
  function deriveColumnRanges(){
    const years = [];
    teachers.forEach(t => {
      t.events.forEach(ev => {
        if(ev.status === 'pending'){
          if(ev.span){
            years.push(ev.span.start, ev.span.end);
          } else {
            years.push(ev.year);
          }
        }
      });
    });
    // Defaults if no non-fulfilled events
    if(years.length === 0){
      return { rapture:{start:NOW,end:NOW+3}, ret:{start:2033,end:2036} };
    }
    const uniq = [...new Set(years)].sort((a,b) => a-b);

    // Helper: min/max with default fallback for empty arrays
    function safeMin(arr, fallback){ return arr.length ? Math.min(...arr) : fallback; }
    function safeMax(arr, fallback){ return arr.length ? Math.max(...arr) : fallback; }

    // Find largest gap
    let maxGap = 0, splitAt = -1;
    for(let i = 1; i < uniq.length; i++){
      const gap = uniq[i] - uniq[i-1];
      if(gap > maxGap){ maxGap = gap; splitAt = i; }
    }
    // If no significant gap or only one group, split at 2030 midpoint
    if(splitAt < 0 || maxGap < 1.5){
      const below = uniq.filter(y => y <= 2030);
      const above = uniq.filter(y => y > 2030);
      return {
        rapture:{start:Math.min(NOW, safeMin(below, NOW)), end:Math.max(NOW+1, safeMax(below, NOW+1))},
        ret:{start:above.length ? above[0] : 2033, end:above.length ? safeMax(above) + 2 : 2036}
      };
    }
    const first = uniq.slice(0, splitAt);
    const second = uniq.slice(splitAt);
    return {
      rapture:{start:Math.min(NOW, safeMin(first, NOW)), end:Math.max(NOW+1, safeMax(first, NOW+1))},
      ret:{start:second[0], end:safeMax(second) + 2}
    };
  }

  const RAV_COLOR = '#4F8BC9';
  const RET_COLOR = '#D4862B';

  // ─── Derive global ranges (used by consensus & per-teacher bars) ───
  function initRanges(){
    const totalYears = YEAR_END - YEAR_START;
    const track = document.getElementById('cvTlTrack');
    track.style.width = totalYears * PX_YEAR + 'px';
    window._cvColRanges = deriveColumnRanges();
  }

  // ─── Render sidebar ───
  function renderSidebar(){
    const container = document.getElementById('cvSidebarRows');
    teachers.forEach(t => {
      const div = document.createElement('div');
      div.className = 'cv-tl-sidebar-item';
      div.innerHTML = t.name + '<span class="cv-tl-sidebar-method">' + t.role + ' &middot; ' + t.method + '</span>';
      container.appendChild(div);
    });
  }

  // ─── Render lanes ───
  function renderLanes(){
    const container = document.getElementById('cvTlLanes');
    teachers.forEach(t => {
      const lane = document.createElement('div');
      lane.className = 'cv-tl-lane';
      lane.style.height = LANE_H + 'px';

      // Track duplicate years in this lane
      var yearCounts = {};

      t.events.forEach(function(ev){
        // Span events
        if(ev.span){
          var spanEl = document.createElement('div');
          spanEl.className = 'cv-event-span cv-event-span-' + ev.status;
          var spLeft = (ev.span.start - YEAR_START) * PX_YEAR;
          var spWidth = (ev.span.end - ev.span.start) * PX_YEAR;
          spanEl.style.left = spLeft + 'px';
          spanEl.style.width = Math.max(spWidth, PX_YEAR * 0.5) + 'px';
          lane.appendChild(spanEl);
          return;
        }
        // Skip events before the timeline window
        if(ev.year < YEAR_START) return;

        // Offset duplicate-year events horizontally
        yearCounts[ev.year] = (yearCounts[ev.year] || 0) + 1;
        var dupOffset = (yearCounts[ev.year] - 1) * 14;

        var el = document.createElement('div');
        el.className = 'cv-event cv-event-' + ev.status;
        var left$ = (ev.year - YEAR_START) * PX_YEAR + PX_YEAR / 2 - 5 + dupOffset;
        el.style.left = left$ + 'px';
        el.innerHTML = '<div class="cv-event-dot"></div><div class="cv-event-label">' + ev.label + '</div>';
        el.dataset.teacher = t.name;
        el.dataset.year = ev.year;
        el.dataset.status = ev.status;
        el.dataset.desc = ev.desc || '';
        el.addEventListener('mouseenter', showTooltip);
        el.addEventListener('mouseleave', hideTooltip);
        lane.appendChild(el);
      });

      container.appendChild(lane);
    });
  }

  // ─── Render teacher grid ───
  function renderTeacherGrid(){
    const container = document.getElementById('cvTeachersGrid');
    teachers.forEach(t => {
      const card = document.createElement('div');
      card.className = 'cv-teacher-card';
      let html = '<div class="cv-teacher-name">' + t.name + '</div>';
      html += '<div class="cv-teacher-tag" style="border-color:' + t.color + '40;color:' + t.color + '">' + t.role + ' &middot; ' + t.tag + '</div>';
      html += '<div class="cv-teacher-detail">' + t.detail + '</div>';
      html += '<div class="cv-teacher-events">';
      t.events.forEach(ev => {
        var evCls = ev.status === 'fulfilled' ? 'cv-teacher-ev-fulfilled' : (ev.status === 'marker' ? 'cv-teacher-ev-marker' : 'cv-teacher-ev-pending');
        html += '<span class="cv-teacher-ev ' + evCls + '">' + ev.label.replace('✓','').trim() + '</span>';
      });
      html += '</div>';
      card.innerHTML = html;
      container.appendChild(card);
    });

    // framework card
    const card = document.createElement('div');
    card.className = 'cv-teacher-card';
    let html = '<div class="cv-teacher-name">Additional Witnesses (' + frameworkTeachers.length + ')</div>';
    html += '<div class="cv-teacher-tag">Framework</div>';
    html += '<div class="cv-teacher-detail">These teachers affirm the same pre-trib + Daniel 70th week framework without specific dates.</div>';
    html += '<div style="margin-top:0.5rem;display:flex;flex-wrap:wrap;gap:0.2rem">';
    frameworkTeachers.forEach(fw => {
      html += '<span style="font-size:0.4rem;padding:0.1rem 0.3rem;border:1px solid rgba(212,175,55,0.1);border-radius:2px;color:rgba(245,240,230,0.5)">' + fw.name + '</span>';
    });
    html += '</div></div>';
    card.innerHTML = html;
    container.appendChild(card);
  }

  // ─── Scroll to now ───
  function scrollToNow(){
    const scroll = document.getElementById('cvTlScroll');
    const nowLeft = (NOW - YEAR_START - 3) * PX_YEAR;
    scroll.scrollLeft = Math.max(0, nowLeft);
  }

  // ─── Consensus row (sidebar + lane) ───
  function buildConsensusRow(){
    // Sidebar entry
    const side = document.getElementById('cvSidebarRows');
    var sideEl = document.createElement('div');
    sideEl.className = 'cv-tl-sidebar-consensus';
    sideEl.textContent = 'Pre-Trib Agreement · 21 teachers';
    side.appendChild(sideEl);

    // Lane
    var track = document.getElementById('cvTlTrack');
    var lane = document.createElement('div');
    lane.className = 'cv-tl-lane cv-lane-consensus';
    lane.id = 'cvLaneConsensus';

    var bar = document.createElement('div');
    bar.className = 'cv-consensus-bar';

    var fill = document.createElement('div');
    fill.className = 'cv-consensus-fill';
    bar.appendChild(fill);
    lane.appendChild(bar);
    track.appendChild(lane);

    // Set fill width
    var totalWidth = (YEAR_END - YEAR_START) * PX_YEAR;
    var ranges = window._cvColRanges || deriveColumnRanges();
    var start = Math.min(NOW, ranges.rapture.start);
    var end = ranges.ret.end;
    fill.style.width = ((end - start) / (YEAR_END - YEAR_START) * 100) + '%';
  }

  // ─── Per-teacher rapture & return bars ───
  function renderLaneHighlights(){
    const ranges = window._cvColRanges;
    if(!ranges) return;
    const splitYear = Math.round(ranges.rapture.end);

    const lanes = document.querySelectorAll('#cvTlLanes .cv-tl-lane');
    teachers.forEach(function(t, i){
      const lane = lanes[i];
      if(!lane) return;

      var ravYears = [], retYears = [];

      t.events.forEach(function(ev){
        if(ev.status !== 'pending') return;
        if(ev.span){
          if(ev.span.start <= splitYear) ravYears.push(ev.span.start, Math.min(ev.span.end, splitYear));
          if(ev.span.end > splitYear) retYears.push(Math.max(ev.span.start, splitYear + 0.5), ev.span.end);
        } else {
          if(ev.year <= splitYear) ravYears.push(ev.year);
          else retYears.push(ev.year);
        }
      });

      function makeBar(yearArr, cls, leftOff){
        if(yearArr.length === 0) return;
        var mn = Math.min.apply(null, yearArr);
        var mx = Math.max.apply(null, yearArr);
        if(mn === mx) mx = mn + 0.3;
        var bar = document.createElement('div');
        bar.className = 'cv-lane-highlight ' + cls;
        bar.style.left = (mn - YEAR_START) * PX_YEAR + 'px';
        bar.style.width = (mx - mn) * PX_YEAR + 'px';
        lane.insertBefore(bar, leftOff);
      }

      makeBar(ravYears, 'cv-lane-rav', lane.firstChild);
      makeBar(retYears, 'cv-lane-ret', lane.firstChild);
    });
  }

  // ─── Tooltip ───
  let tooltipEl = null;
  function getTooltip(){
    if(!tooltipEl){
      tooltipEl = document.createElement('div');
      tooltipEl.className = 'cv-event-tooltip';
      tooltipEl.style.display = 'none';
      document.getElementById('cvTlTrack').appendChild(tooltipEl);
    }
    return tooltipEl;
  }
  function showTooltip(e){
    const el = e.currentTarget;
    const label = el.querySelector('.cv-event-label');
    if(!label) return;
    const tt = getTooltip();
    const labelText = label.textContent.replace('✓','').trim();
    const desc = el.dataset.desc || '';
    if(desc) el.classList.add('cv-event-has-desc');
    tt.innerHTML =
      '<div class="cv-tt-header">' + labelText + '</div>' +
      (desc ? '<div class="cv-tt-desc">' + desc + '</div>' : '') +
      '<div class="cv-tt-body"><span>' + el.dataset.teacher + '</span><span>' + el.dataset.year + '</span></div>' +
      '<div class="cv-tt-status ' + el.dataset.status + '">' + (el.dataset.status === 'fulfilled' ? 'Fulfilled' : el.dataset.status === 'marker' ? 'Marker' : 'Pending') + '</div>';
    const track = document.getElementById('cvTlTrack');
    const evRect = el.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    tt.style.left = Math.max(0, evRect.left - trackRect.left - 60) + 'px';
    tt.style.top = Math.max(4, evRect.top - trackRect.top - 48) + 'px';
    tt.style.display = 'block';
  }
  function hideTooltip(){
    const tt = getTooltip();
    tt.style.display = 'none';
  }

  // ─── Drag to scroll ───
  function initDragScroll(){
    const scroll = document.getElementById('cvTlScroll');
    let isDown = false, startX, scrollLeft;
    scroll.addEventListener('mousedown', function(e){
      if(e.button !== 0) return;
      if(e.target.closest('.cv-event, .cv-tl-year')) return;
      isDown = true;
      scroll.classList.add('grabbing');
      startX = e.pageX - scroll.getBoundingClientRect().left;
      scrollLeft = scroll.scrollLeft;
    });
    scroll.addEventListener('mousemove', function(e){
      if(!isDown) return;
      e.preventDefault();
      const x = e.pageX - scroll.getBoundingClientRect().left;
      scroll.scrollLeft = scrollLeft - (x - startX) * 1.5;
    });
    function endDrag(){ isDown = false; scroll.classList.remove('grabbing'); }
    scroll.addEventListener('mouseup', endDrag);
    scroll.addEventListener('mouseleave', endDrag);
  }

  // ─── Sync sidebar + timeline vertical scroll ───
  function initVerticalSync(){
    const scroll = document.getElementById('cvTlScroll');
    const sidebar = document.getElementById('cvSidebarRows');
    let syncing = false;
    scroll.addEventListener('scroll', function(){
      if(syncing) return;
      syncing = true;
      sidebar.scrollTop = this.scrollTop;
      syncing = false;
    });
    sidebar.addEventListener('scroll', function(){
      if(syncing) return;
      syncing = true;
      scroll.scrollTop = this.scrollTop;
      syncing = false;
    });
  }

  // ─── Init ───
  function init(){
    renderYears();
    initRanges();
    renderSidebar();
    renderLanes();
    renderLaneHighlights();
    renderTeacherGrid();
    buildConsensusRow();
    initDragScroll();
    initVerticalSync();
    setTimeout(scrollToNow, 100);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
