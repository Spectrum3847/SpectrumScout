/**
 * Returns the eTag and content text from a TBA API endpoint
 * 
 * @param {str} url          API endpoint to fetch
 * @return {[str, Object]}   ETag and fetched content
 */
function tbaQuery(url) {
  var baseUrl = 'https://www.thebluealliance.com/api/v3/'; 
  var options = {
    "headers" : {'X-TBA-Auth-Key': '3z8yVS4oRJjcbezOhufF3JIno5GPEYZsywpizwlLoZoZFsAAubmGbdt2f52n21Us'}
  }
  var httpResponse = UrlFetchApp.fetch(baseUrl + url, options);
  
  var lastMod = httpResponse.getHeaders()['ETag'];
  var contentText = JSON.parse(httpResponse.getContentText());
  return [lastMod, contentText];
}

/**
 * Returns a column array of team numbers from a given event
 * 
 * @param {str} event_code   Event to get team numbers for
 * @return {Array}           Nx1 array of team numbers
 */
function getTeams(event_code) {
  var [,data] = tbaQuery('event/' + event_code + '/teams/simple');
  var teams = data.map(a => a.team_number); // array of team numbers
  teams.sort((a,b) => a - b); // sorted numerically

  return teams
}

/**
 * Returns an array of the qualification match schedule in format [qm1, R1, R2, R3, B1, B2, B3]
 * 
 * @param {str} event_code   Event to get schedule for
 * @param {int} team_number  Optional: team number to get schedule for. If undefined, all matches are returned
 * @return {Array}           Nx7 array of match numbers and team numbers
 */
function getQuals(event_code, team_number) {
  var data;
  
  if(typeof team_number !== "undefined")
    [,data] = tbaQuery('team/frc' + team_number + '/event/' + event_code + '/matches/simple');
  else
    [,data] = tbaQuery('event/' + event_code + '/matches/simple');

  if(data.length == 0)
    return;

  var matches = data.filter(a => a.comp_level == 'qm'); // keep quals matches only
  matches.sort((a, b) => a.match_number - b.match_number); // sort by match number

  matches = matches.map(a => 'qm' + a.match_number)

  return matches;
}

/**
 * Returns an array of the qualification alliances in format [R1, R2, R3],  [B1, B2, B3] 
 * 
 * @param {str} event_code   Event to get alliances for
 * @param {int} team_number  Team number to get alliances for. If undefined, both alliances for all matches are returned
 * @return {Array}           Nx3 or 2Nx3 array of team numbers
 */
function getQualsAlliances(event_code, team_number) {
  var data;
  
  if(typeof team_number !== "undefined")
    [,data] = tbaQuery('team/frc' + team_number + '/event/' + event_code + '/matches/simple');
  else
    [,data] = tbaQuery('event/' + event_code + '/matches/simple');

  if(data.length == 0)
    return

  var matches = data.filter(a => a.comp_level == 'qm'); // keep quals matches only
  matches.sort((a, b) => a.match_number - b.match_number); // sort by match number

  var matchData = alliancesFromEventData(matches);

  if(typeof team_number !== "undefined")
    matchData = matchData.filter(a => a.includes(String(team_number)))

  return matchData;
}

function alliancesFromEventData(data) {
  var alliances = [];
  data.forEach(matchRawData => {
    alliances.push(matchRawData['alliances']['red']['team_keys'].map(key => key.substring(3)));
    alliances.push(matchRawData['alliances']['blue']['team_keys'].map(key => key.substring(3)));
  })
  return alliances;
}

function scoreFromEventData(data, scoreNames) {
  if(Array.isArray(scoreNames) == false)
    scoreNames = [scoreNames]

  var scores = [];
  data.forEach(matchRawData => {
    scores.push(scoreNames.map(s => matchRawData['score_breakdown']['red'][s]));
    scores.push(scoreNames.map(s => matchRawData['score_breakdown']['blue'][s]));
  })

  return scores;
}


/**
 * Returns an array of the qualification match schedule in format [qm1, R1, R2, R3, B1, B2, B3]
 * 
 * @param {str} event_code   Event to get schedule for
 * @param {int} team_number  Optional: team number to get schedule for. If undefined, all matches are returned
 * @return {Array}           Nx7 array of match numbers and team numbers
 */
function getQualsSchedule(event_code, team_number) {
  var data;
  
  if(typeof team_number !== "undefined")
    [,data] = tbaQuery('team/frc' + team_number + '/event/' + event_code + '/matches/simple');
  else
    [,data] = tbaQuery('event/' + event_code + '/matches/simple');

  if(data.length == 0)
    return;

  var matches = data.filter(a => a.comp_level == 'qm'); // keep quals matches only
  matches.sort((a, b) => a.match_number - b.match_number); // sort by match number

  matches = matches.map(a => {
    var allianceData = ['qm' + a.match_number]; // qm#
    allianceData = allianceData.concat(a['alliances']['red']['team_keys'].map(key => key.substring(3))); // R1, R2, R3
    allianceData = allianceData.concat(a['alliances']['blue']['team_keys'].map(key => key.substring(3))); // B1, B2, B3
    
    return allianceData;
  })

  return matches;
}

/**
 * Returns OPRs from qualification matches that have been played
 * 
 * @param {str} event_code        Event to get OPRs for
 * @param {str, Array} scoreName  Optional: score breakdown to use for cOPR. If undefined, returns totalPoints OPR.
 * @return {Array}                Column 1: teams. Column 2-N: OPRs
 */
function getOpr(event_code, scoreName='totalPoints') {
  if(scoreName == 'all') {
    scoreName = ['totalPoints', 'auto', 'mobility', 'auto cube low', 'auto cube mid', 'auto cube high', 'auto cone low', 
    'auto cone mid', 'auto cone high', 'teleop cube low', 'teleop cube mid', 'teleop cube high', 'teleop cone low', 'teleop cone mid', 
    'teleop cone high', 'endgame']
  }

  if(Array.isArray(scoreName) == false)
    scoreName = [scoreName]
  else
    scoreName = scoreName.flat(); // arrays read from function({a, b}) in as  [[a, b]]

  var [,data] = tbaQuery('event/' + event_code + '/matches');
  
  if(data.length == 0)
    return;

  var matches = data.filter(a => a.comp_level == 'qm' && a.score_breakdown != null); // keep quals matches only
  matches.sort((a, b) => a.match_number - b.match_number); // sort by match number
  
  var alliances = alliancesFromEventData(matches);
  var teams = [...new Set(alliances.flat())].sort((a,b) => a - b); // in case teams that registered didn't play
 
  var A = formA(teams, alliances);

  // 2023 specific
  var autoChargeStation = scoreFromEventData(matches, ['autoChargeStationRobot1', 'autoChargeStationRobot2', 'autoChargeStationRobot3']);
  var autoBridgeState = scoreFromEventData(matches, ['autoBridgeState']);
  var auto = [];
  autoChargeStation.forEach((arr, i) => {
    if(autoBridgeState[i][0] == 'Level')
      auto.push(arr.map(a => a === 'Docked' ? 'Engaged' : a)); // replace Docked with Engaged if Level
    else
      auto.push(arr);
  })

  // auto cube and cone
  var autoCommunity = scoreFromEventData(matches, ['autoCommunity']);
  var autoCubeLow = autoCommunity.map(a => a[0]['B']).map(a => a.filter(a => a === 'Cube').length);
  var autoCubeMid = autoCommunity.map(a => a[0]['M']).map(a => a.filter(a => a === 'Cube').length);
  var autoCubeHigh = autoCommunity.map(a => a[0]['T']).map(a => a.filter(a => a === 'Cube').length);
  var autoConeLow = autoCommunity.map(a => a[0]['B']).map(a => a.filter(a => a === 'Cone').length);
  var autoConeMid = autoCommunity.map(a => a[0]['M']).map(a => a.filter(a => a === 'Cone').length);
  var autoConeHigh = autoCommunity.map(a => a[0]['T']).map(a => a.filter(a => a === 'Cone').length);

  var teleopCommunity = scoreFromEventData(matches, ['teleopCommunity']);
  var teleopCubeLow = teleopCommunity.map(a => a[0]['B']).map(a => a.filter(a => a === 'Cube').length);
  var teleopCubeMid = teleopCommunity.map(a => a[0]['M']).map(a => a.filter(a => a === 'Cube').length);
  var teleopCubeHigh = teleopCommunity.map(a => a[0]['T']).map(a => a.filter(a => a === 'Cube').length);
  var teleopConeLow = teleopCommunity.map(a => a[0]['B']).map(a => a.filter(a => a === 'Cone').length);
  var teleopConeMid = teleopCommunity.map(a => a[0]['M']).map(a => a.filter(a => a === 'Cone').length);
  var teleopConeHigh = teleopCommunity.map(a => a[0]['T']).map(a => a.filter(a => a === 'Cone').length);

  // endgame
  var endgameChargeStation = scoreFromEventData(matches, ['endGameChargeStationRobot1', 'endgameChargeStationRobot2', 'endgameChargeStationRobot3']);
  var endgameBridgeState = scoreFromEventData(matches, ['endGameBridgeState']);
  var endgame = [];
  endgameChargeStation.forEach((arr, i) => {
    if(endgameBridgeState[i][0] == 'Level')
      endgame.push(arr.map(a => a === 'Docked' ? 'Engaged' : a)); // replace Docked with Engaged if Level
    else
      endgame.push(arr);
  })

  var scores = [];
  scores.push(['teams'].concat(teams));
  scoreName.forEach(s => {
    if(s == 'endgame') {
      scores.push(['Endgame park'].concat(team_avg(teams, alliances, endgame, 'Park').flat()));
      scores.push(['Endgame docked'].concat(team_avg(teams, alliances, endgame, 'Docked').flat()));
      scores.push(['Endgame engaged'].concat(team_avg(teams, alliances, endgame, 'Engaged').flat()));
    }
    if(s == 'auto') {
      scores.push(['Auto docked'].concat(team_avg(teams, alliances, auto, 'Docked').flat()));
      scores.push(['Auto engaged'].concat(team_avg(teams, alliances, auto, 'Engaged').flat()));
    }
    else if(s == 'mobility') {
      scores.push(['Auto mobility'].concat(team_avg(teams, alliances, scoreFromEventData(matches, ['mobilityRobot1', 'mobilityRobot2', 'mobilityRobot3']), 'Yes').flat()));
    }
    else if(s == 'auto cube low') {
      scores.push(['Auto cube low'].concat(opr(A, autoCubeLow).flat()));
    }
    else if(s == 'auto cube mid') {
      scores.push(['Auto cube mid'].concat(opr(A, autoCubeMid).flat()));
    }
    else if(s == 'auto cube high') {
      scores.push(['Auto cube high'].concat(opr(A, autoCubeHigh).flat()));
    }
    else if(s == 'auto cone low') {
      scores.push(['Auto cone low'].concat(opr(A, autoConeLow).flat()));
    }
    else if(s == 'auto cone mid') {
      scores.push(['Auto cone mid'].concat(opr(A, autoConeMid).flat()));
    }
    else if(s == 'auto cone high') {
      scores.push(['Auto cone high'].concat(opr(A, autoConeHigh).flat()));
    }
    else if(s == 'teleop cube low') {
      scores.push(['Teleop cube low'].concat(opr(A, teleopCubeLow).flat()));
    }
    else if(s == 'teleop cube mid') {
      scores.push(['Teleop cube mid'].concat(opr(A, teleopCubeMid).flat()));
    }
    else if(s == 'teleop cube high') {
      scores.push(['Teleop cube high'].concat(opr(A, teleopCubeHigh).flat()));
    }
    else if(s == 'teleop cone low') {
      scores.push(['Teleop cone low'].concat(opr(A, teleopConeLow).flat()));
    }
    else if(s == 'teleop cone mid') {
      scores.push(['Teleop cone mid'].concat(opr(A, teleopConeMid).flat()));
    }
    else if(s == 'teleop cone high') {
      scores.push(['Teleop cone high'].concat(opr(A, teleopConeHigh).flat()));
    }
    else {
      scores.push([s].concat(opr(A, scoreFromEventData(matches, s)).flat()));
    }
  })
  scores = transpose(scores);
  return scores;
}

//=======================================================================================//
// OPR FUNCTIONS
//=======================================================================================//

/**
 * Forms the sparse matrix A for use in the least squares equation
 * 
 * @param {Array} teams     Nx1 array of team numbers
 * @param {Array} alliances Nx3 array of alliances, with each row corresponding to one alliance
 * @return {Array}          NxM array of the sparse matrix of teams per alliance
 */
function formA(teams, alliances) {
  return alliances.map(alliance => teams.map(team => (alliance.includes(team))*1));
}

/**
 * Calculates OPR by performing least squares regression on A and b
 * 
 * @param {Array} scores    Nx1 array of scores, with each row corresponding to one alliance's score
 * @return {Array}          Nx1 array of oprs
 */
function opr(A, scores) {
  scores = transpose(scores.flat())
  var oprs = multiply(inv(multiply(transpose(A), A)), multiply(transpose(A), scores)); // inv(A'*A)A'b  
  if(!Array.isArray(oprs)) { // A'A not invertible
    oprs = [...Array(scores.length)].map(e => Array(1));
  }
  return oprs;
}

/**
 * Calculates the alliance average (avg of the points scored by the alliances that team was on)
 * 
 * @param {Array} teams     Nx1 array of team numbers
 * @param {Array} alliances Nx3 array of scores, with each row corresponding to one alliance's score
 * @return {Array}          Nx1 array of oprs
 */
function alliance_avg(teams, alliances, scores, desired_score) {
  scores = scores.map(val => [val, val, val]);
  return avg(teams, alliances, scores, desired_score);
}
/**
 * Calculates the team average (avg of times the team got a specific score)
 * 
 * @param {Array} teams          Nx1 array of team numbers
 * @param {Array} alliances      Nx3 array of scores, with each row corresponding to one alliance's score
 * @param {Array} scores         Nx1 array of scores, with each row corresponding to one alliance's score
 * @param {Str} desired_score    Nx1 array of scores, with each row corresponding to one alliance's score
 * @return {Array}               Nx1 array of oprs
 */
function team_avg(teams, alliances, scores, desired_score) {
//  if(desired_score != undefined)
//    scores = scores.map(row => row.map(val => (val==desired_score)*1));
  return avg(teams, alliances, scores, desired_score);
}

function avg(teams, alliances, scores, desired_score) {
  alliances = alliances.flat();
  scores = scores.flat(Infinity);
  
  if(desired_score != undefined)
    scores = scores.map(val => (val==desired_score)*1);
  
  var scores_sum = teams.map(team => scores.filter((val, i) => alliances[i] == team).reduce((a,b) => a+b,0));
  var num_matches = teams.map(team => alliances.reduce((n, val) => n + (val == team), 0));
  
  return scores_sum.map((score, i) => [score/num_matches[i]]);
}

function elo(teams, alliances, scores) {
  teams = teams.flat();
  scores = scores.flat();
  alliances = alliances.map(alliance => alliance.map(team => teams.indexOf(team)));
  
  var elos = teams.map(val => 1500);
  var k = 32;
  
  for(let i = 0; i < alliances.length/2; i+=2) { 
    var blue_elo = alliances[i].map(team_ind => elos[team_ind]).reduce((a,b) => a+b,0);
    var red_elo = alliances[i+1].map(team_ind => elos[team_ind]).reduce((a,b) => a+b,0);
    
    var Ea = 1/(1 + 10**((red_elo - blue_elo)/400));
    var Eb = 1/(1 + 10**((blue_elo - red_elo)/400));
    
    var Sa = 0.5 + (scores[i] > scores[i+1])*0.5;
    var Sb = 0.5 + (scores[i+1] > scores[i])*0.5;
    
    alliances[i].forEach(team_ind => elos[team_ind] += k*(Sa - Ea));
    alliances[i+1].forEach(team_ind => elos[team_ind] += k*(Sb - Eb));
  }
  
  return transpose(elos);
}

//=======================================================================================//
// MATRIX FUNCTIONS
//=======================================================================================//

/** 
 * Calculates the transpose of an array.
 *
 * From: https://stackoverflow.com/a/17428705
 *
 * @param {Array} a     Array to be inverted
 * @return {Array}      Inverse of a
 */
function transpose(a) {
  if(!Array.isArray(a[0])) // row vector
    return a.map(val => [val]);
  if(a[0].length == 1) // column vector
    return a.flat();
  return a[0].map((col, i) => a.map(row => row[i]))
}

/** 
 * Calculates the dot product of two arrays.
 *
 * From: https://stackoverflow.com/a/48694670
 *
 * @param {Array} a     First array to multiply
 * @param {Array} b     Second array to multiply
 * @return {Array}      Dot product of a and b
 */
function multiply(a, b) {
  var result = new Array(a.length).fill(0).map(row => new Array(b[0].length).fill(0));
  return result.map((row, i) => row.map((val, j) => a[i].reduce((sum, elm, k) => sum + (elm*b[k][j]) ,0)))
}

function diag(l) {
  var arr = l.map(val => new Array(l.length).fill(0));
  return arr.map((row, i) => row.map((val,j) => (i==j)*l[i]));
}

/**
 * Inverts an array.
 *
 * Adapted from: http://blog.acipo.com/matrix-inversion-in-javascript/
 *
 * @param {Array} a
 */
function inv(a) {
  var dim = a.length;
  var I = a.map((row,i) => row.map((val,j) => (i==j)*1)); // identity matrix
  var C = a; // copy
  
  for(let i = 0; i < dim; i++) {
    var e = C[i][i];
    
    if(e == 0) {
      for(let ii = i+1; ii < dim; ii++) {
        if(C[ii][i] != 0) {
          [C[i], C[ii]] = [C[ii], C[i]];
          [I[i], I[ii]] = [I[ii], I[i]];
          break;
        }
      }
      e = C[i][i];
      if(e == 0) {return;} // not invertable
    }
    
    C[i] = C[i].map(val => val/e);
    I[i] = I[i].map(val => val/e);
    
    for(ii = 0; ii < dim; ii++){
      if(ii == i) {continue;}
      e = C[ii][i];
      
      C[ii] = C[ii].map((val,j) => val-e*C[i][j]);
      I[ii] = I[ii].map((val,j) => val-e*I[i][j]);
    }
  }
  return I;
}

