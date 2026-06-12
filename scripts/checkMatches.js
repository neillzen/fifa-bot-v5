import fs from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'posted_matches.json');

export function getFinishedMatches(matches) {
  return matches.filter(m => m.status === 'FT' || m.status === 'FINISHED');
}

export function markAsPosted(matchId) {
  let posted = [];
  if (fs.existsSync(DATA_FILE)) {
    posted = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  if (!posted.includes(matchId)) {
    posted.push(matchId);
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(posted, null, 2));
  }
}

export default { getFinishedMatches, markAsPosted }; 
