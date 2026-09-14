const fs = require('fs');
let content = fs.readFileSync('app/page.js', 'utf8');

// 1. Remove state declarations
content = content.replace(/const \[uWaitlist, setUWaitlist\] = useState\(false\);\n/g, '');
content = content.replace(/const \[uWaitlistTimes, setUWaitlistTimes\] = useState\(\[\]\);\n/g, '');

// 2. Remove state resets
content = content.replace(/setUWaitlist\(false\);\n/g, '');
content = content.replace(/setUWaitlistTimes\(\[\]\);\n/g, '');
content = content.replace(/if \(noCapacity\) setUWaitlist\(true\); else setUWaitlist\(false\);/g, '');

// 3. Rewrite selectTime
const selectTimeRegex = /const selectTime = \(time, isWaitlistTime\) => \{[\s\S]*?setUTime\(time\);\n\s*setUMeal\(parseInt\(time\.split\(':'\)\[0\], 10\) >= 17 \? 'cena' : 'comida'\);\n\s*\};/g;
const newSelectTime = `const selectTime = (time, isFull) => {
    if (isFull) return;
    setUTime(time);
    setUMeal(parseInt(time.split(':')[0], 10) >= 17 ? 'cena' : 'comida');
  };`;
content = content.replace(selectTimeRegex, newSelectTime);

// 4. Update the time button onClick
content = content.replace(/onClick=\{\(\) => selectTime\(s\.time, isFull\)\}/g, 'onClick={() => selectTime(s.time, isFull)} disabled={isFull}');

// 5. Update time button styles
// From: ${isFull && uWaitlistTimes.includes(s.time) ? ...}
content = content.replace(/\$\{isFull && uWaitlistTimes\.includes\(s\.time\) \? 'border-orange-500 bg-orange-100 text-orange-800 ring-2 ring-orange-300' : ''\}/g, '');
content = content.replace(/\$\{isFull && !uWaitlistTimes\.includes\(s\.time\) \? 'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-400' : ''\}/g, '');
content = content.replace(/\$\{isFull \? 'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed' : ''\}/g, '${isFull ? \'border-slate-100 text-slate-300 bg-slate-50 cursor-not-allowed\' : \'\'}');
// Wait, I need to make sure disabled styling is correct. Let's just replace the whole className logic for the time button.
// Actually, it's easier to use a regex replacement carefully.

// Let's do it manually with file replace or a simpler script.
