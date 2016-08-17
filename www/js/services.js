angular.module("starter.services", [])

.service("ImageCache", function (/* $localStorage, */ _) {
	var STORE_KEY_TEAM_LOGOS;

	STORE_KEY_TEAM_LOGOS = "realitySportsApp.ImageCache>logos";

	function logosFromBoxScores(boxScores) {
		var teamLogos;

		teamLogos = _.reduce(boxScores, function (logos, boxScore) {
			logos[boxScore.awayTeam.team.teamId] =
				boxScore.awayTeam.imageUrl;

			logos[boxScore.homeTeam.team.teamId] =
				boxScore.homeTeam.imageUrl;

			return logos;
		}, {});

		return logos(teamLogos);
	}

	function logos (l) {
		if (l) {
			localStorage.setItem(STORE_KEY_TEAM_LOGOS, JSON.stringify(l));
		}

		return JSON.parse(localStorage.getItem(STORE_KEY_TEAM_LOGOS) || "[]");
	}

	function teamLogo(team) {
		var teamLogos = logos();

		if (!team || !teamLogos) { return ""; }

		return teamLogos[team];
	}

	function clearLogos () {
		localStorage.setItem(STORE_KEY_TEAM_LOGOS, "");
	}

	return {
		logos: logos,
		clearLogos: clearLogos,
		logosFromBoxScores: logosFromBoxScores,
		teamLogo: teamLogo
	};
})

.service("LeagueService", function ($http, $q, AppSettings, AppStateService, CacheService, AuthTokenStore) {
	var previousSession;

	return {
		list: list
	};

	function list(force) {
		return $http({
			method: "GET",
			// url: AppSettings.apiHost + "/v1/leagues"
			url: AppSettings.apiHost + "/v2/leagues"
		}).then(function (response) {
			if (!response || !response.data) { return; }

			CacheService.leagues(response.data);

			return response;
		});
	}

	function set(leagueId, force) {
		// this call is expensive, so 200 OK! if it's a repeat request
		if (leagueId === AppStateService.currentLeagueId() && previousSession === AuthTokenStore.session() && !force) {
			return $q.resolve();
		}

		return $http({
			method: "PUT",
			url: AppSettings.apiHost + "/v1/leagues/" + leagueId
		}).then(function (response) {
			AppStateService.currentLeagueId(leagueId);
			previousSession = AuthTokenStore.session();
		});
	}
})

.factory("AuthTokenStore", function (/* $localStorage */) {
	var STORE_KEY_TOKEN, STORE_KEY_SESSION;

	STORE_KEY_TOKEN = "realitySportsApp.AuthService>token";
	STORE_KEY_SESSION = "realitySportsApp.AuthService>session";

	function token (t) {
		if (t) {
			localStorage.setItem(STORE_KEY_TOKEN, t);
		}

		return localStorage.getItem(STORE_KEY_TOKEN);
	}

	function clearToken () {
		localStorage.setItem(STORE_KEY_TOKEN, "");
	}

	function session (s) {
		if (s) {
			localStorage.setItem(STORE_KEY_SESSION, s);
		}

		return localStorage.getItem(STORE_KEY_SESSION);
	}

	function clearSession () {
		localStorage.setItem(STORE_KEY_SESSION, "");
	}

	return {
		token: token,
		session: session,
		clearToken: clearToken,
		clearSession: clearSession
	};
})

.service("AuthService", function ($http, AppSettings, AuthTokenStore) {
	return {
		refreshSession: refreshSession,
		login: login
	};

	function refreshSession () {
		AuthTokenStore.clearSession();

		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v1/tokens"
		});
	}

	function login (data) {
		return $http({
			method: "POST",
			// url: AppSettings.apiHost + "/v1/tokens",
			url: AppSettings.apiHost + "/v2/tokens",
			data: data
		});
	}
})

.service("CacheService", function (/* $localStorage, */ _) {
	var STORE_KEY_LEAGUES;

	STORE_KEY_LEAGUES = "realitySportsApp.Cache>leagues";

	return {
		leagues: leagues,
		getLeagueById: getLeagueById
	};

	function leagues(leaguesData) {
		if (leaguesData) {
			localStorage.setItem(STORE_KEY_LEAGUES, JSON.stringify(leaguesData));
		}

		return JSON.parse(localStorage.getItem(STORE_KEY_LEAGUES) || "[]");
	}

	function getLeagueById(leagueId) {
		leagueId = parseInt(leagueId, 10);

		return _.find(leagues(), function (l) {
			return l.leagueId === leagueId;
		});
	}
})

.service("AppStateService", function (moment) {
	var STORE_KEY_CURRENT_LEAGUE, STORE_KEY_LEAGUES, STORE_KEY_CURRENT_WEEK, STORE_KEY_CURRENT_EMAIL;

	STORE_KEY_CURRENT_LEAGUE = "realitySportsApp.AppState>currentLeagueId";
	STORE_KEY_LEAGUES = "realitySportsApp.AppState>leagues";
	STORE_KEY_CURRENT_WEEK = "realitySportsApp.AppState>currentWeek";
	STORE_KEY_CURRENT_EMAIL = "realitySportsApp.AppState>currentEmail";
	STORE_KEY_CURRENT_PLAYER_FILTERS = "realitySportsApp.AppState>currentPlayerFilters";

	var OPENING_NIGHT = moment("2015-09-09");
	var WEEK  = 24 * 60 * 60 * 1000;

	return {
		currentLeagueId: currentLeagueId,
		currentPlayerFilters: currentPlayerFilters,
		clearCurrentLeagueId: clearCurrentLeagueId,
		clearCurrentPlayerFilters: clearCurrentPlayerFilters,
		currentWeek: currentWeek,
		currentEmail: currentEmail,
		guessCurrentWeek: guessCurrentWeek
	};

	function currentLeagueId (leagueId) {
		if (leagueId) {
			localStorage.setItem(STORE_KEY_CURRENT_LEAGUE, leagueId);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_LEAGUE);
	}

	function clearCurrentLeagueId() {
		localStorage.setItem(STORE_KEY_CURRENT_LEAGUE, "");
	}

	function currentPlayerFilters (filters) {
		if (filters) {
			localStorage.setItem(STORE_KEY_CURRENT_PLAYER_FILTERS, JSON.stringify(filters));
		}

		try {
			return JSON.parse(localStorage.getItem(STORE_KEY_CURRENT_PLAYER_FILTERS));
		} catch(e) {
			return null;
		}
	}

	function clearCurrentPlayerFilters() {
		localStorage.setItem(STORE_KEY_CURRENT_PLAYER_FILTERS, "");
	}

	function currentWeek (leagueId) {
		if (leagueId) {
			localStorage.setItem(STORE_KEY_CURRENT_WEEK, leagueId);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_WEEK);
	}

	function guessCurrentWeek () {
		return Math.floor(OPENING_NIGHT.diff(moment()) / (-7 * WEEK)) + 1;
	}

	function currentEmail (e) {
		if (e) {
			localStorage.setItem(STORE_KEY_CURRENT_EMAIL, e);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_EMAIL);
	}
})

.service("ScoreboardService", function ($http, AppSettings, AppStateService) {
	return {
		fetch: fetch
	};

	function fetch(leagueId, week, gameId) {
		if (!week) {
			week = AppStateService.currentWeek() || "";
		}

		return $http({
			method: "GET",
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/scoreboards/" + week
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/scoreboards"
		});
	}
})

.service("StandingsService", function ($http, AppSettings) {
	return {
		fetch: fetch
	};

	function fetch(leagueId, week) {
		return $http({
			method: "GET",
			cache: true,
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/standings"
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/standings"
		});
	}
})

.service("PlayersService", function ($http, AppSettings, $q, _, AppStateService) {
	return {
		list: list,
		read: read,
		defaultFilters: {
			playerFilter: "all",
			posFilter: "ALL",
			txtSearch: ""
		},
		playerFilterOptions: {
			all: "All",
			myroster: "My Roster",
			available: "Available"
		},
		currentFilters: currentFilters,
		isEmptyFilters: isEmptyFilters
	};

	function list(leagueId, filters) {
		// return $q.resolve({
		// 	data: [{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":3,"ownedTeamName":"Señor Commish","isAvailable":false,"isLocked":true,"byeWeek":8,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"11852","firstName":"Le'Veon","lastName":"Bell","nflTeam":"PIT ","pos":"RB","opponent":"@WAS "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":226.88,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":5000.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":5,"ownedTeamName":"Scooter","isAvailable":false,"isLocked":true,"byeWeek":8,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"9253 ","firstName":"Antonio","lastName":"Brown","nflTeam":"PIT ","pos":"WR","opponent":"@WAS "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":377.36,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":4,"ownedTeamName":"Fantasy ain't my Forte","isAvailable":false,"isLocked":true,"byeWeek":9,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"15506","firstName":"David","lastName":"Johnson","nflTeam":"ARI ","pos":"RB","opponent":"NE   "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":311.04,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":6680.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":1,"ownedTeamName":"Hangin' with Mr. Cooper","isAvailable":false,"isLocked":true,"byeWeek":11,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"10025","firstName":"Julio","lastName":"Jones","nflTeam":"ATL ","pos":"WR","opponent":"TB   "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":350.30,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":10,"ownedTeamName":"GRIMES","isAvailable":false,"isLocked":true,"byeWeek":8,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"23215","firstName":"Todd","lastName":"Gurley","nflTeam":"LA  ","pos":"RB","opponent":"@SF  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":291.31,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":23000.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":5,"ownedTeamName":"Scooter","isAvailable":false,"isLocked":true,"byeWeek":7,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"9735 ","firstName":"Cam","lastName":"Newton","nflTeam":"CAR ","pos":"QB","opponent":"@DEN "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":671.59,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":2,"ownedTeamName":"Burton","isAvailable":false,"isLocked":true,"byeWeek":8,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"13688","firstName":"Odell","lastName":"Beckham Jr.","nflTeam":"NYG ","pos":"WR","opponent":"@DAL "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":311.00,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":10,"ownedTeamName":"GRIMES","isAvailable":false,"isLocked":true,"byeWeek":10,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"13160","firstName":"Andrew","lastName":"Luck","nflTeam":"IND ","pos":"QB","opponent":"DET  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":663.89,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":6,"ownedTeamName":"@pnewell4","isAvailable":false,"isLocked":true,"byeWeek":11,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"10769","firstName":"Devonta","lastName":"Freeman","nflTeam":"ATL ","pos":"RB","opponent":"TB   "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":301.63,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":12500.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":5,"ownedTeamName":"Scooter","isAvailable":false,"isLocked":true,"byeWeek":9,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"T0742","firstName":"Rob","lastName":"Gronkowski","nflTeam":"NE  ","pos":"TE","opponent":"@ARI "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":252.90,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":7,"ownedTeamName":"TLowe12","isAvailable":false,"isLocked":true,"byeWeek":5,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"12120","firstName":"Russell","lastName":"Wilson","nflTeam":"SEA ","pos":"QB","opponent":"MIA  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":652.39,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":6,"ownedTeamName":"@pnewell4","isAvailable":false,"isLocked":true,"byeWeek":9,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"10702","firstName":"DeAndre","lastName":"Hopkins","nflTeam":"HOU ","pos":"WR","opponent":"CHI  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":298.30,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":13000.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":9,"ownedTeamName":"34 Run-Three","isAvailable":false,"isLocked":true,"byeWeek":5,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":" 8850","firstName":"Jamaal","lastName":"Charles","nflTeam":"KC  ","pos":"RB","opponent":"SD   "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":274.66,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":9010.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":7,"ownedTeamName":"TLowe12","isAvailable":false,"isLocked":true,"byeWeek":7,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"T0735","firstName":"Dez","lastName":"Bryant","nflTeam":"DAL ","pos":"WR","opponent":"NYG  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":271.90,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":19140.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":4,"ownedTeamName":"Fantasy ain't my Forte","isAvailable":false,"isLocked":true,"byeWeek":4,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":" 7200","firstName":"Aaron","lastName":"Rodgers","nflTeam":"GB  ","pos":"QB","opponent":"@JAC "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":673.75,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":9820.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":3,"ownedTeamName":"Señor Commish","isAvailable":false,"isLocked":true,"byeWeek":8,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":" 6770","firstName":"Ben","lastName":"Roethlisberger","nflTeam":"PIT ","pos":"QB","opponent":"@WAS "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":652.91,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":5000.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":8,"ownedTeamName":"Blazers","isAvailable":false,"isLocked":true,"byeWeek":5,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"9800 ","firstName":"Mark","lastName":"Ingram","nflTeam":"NO  ","pos":"RB","opponent":"OAK  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":267.77,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":9,"ownedTeamName":"34 Run-Three","isAvailable":false,"isLocked":true,"byeWeek":10,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"10723","firstName":"Sammy","lastName":"Watkins","nflTeam":"BUF ","pos":"WR","opponent":"@BAL "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":233.00,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":18120.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":6,"ownedTeamName":"@pnewell4","isAvailable":false,"isLocked":true,"byeWeek":6,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":" 8261","firstName":"Adrian","lastName":"Peterson","nflTeam":"MIN ","pos":"RB","opponent":"@TEN "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":294.95,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":14330.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":10,"ownedTeamName":"GRIMES","isAvailable":false,"isLocked":true,"byeWeek":9,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"9993 ","firstName":"A.J.","lastName":"Green","nflTeam":"CIN ","pos":"WR","opponent":"@NYJ "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":273.00,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":14810.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":1,"ownedTeamName":"Hangin' with Mr. Cooper","isAvailable":false,"isLocked":true,"byeWeek":10,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"T0620","firstName":"LeSean","lastName":"McCoy","nflTeam":"BUF ","pos":"RB","opponent":"@BAL "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":287.98,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":2,"ownedTeamName":"Burton","isAvailable":false,"isLocked":true,"byeWeek":5,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"12029","firstName":"Allen","lastName":"Robinson","nflTeam":"JAC ","pos":"WR","opponent":"GB   "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":238.70,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":3,"ownedTeamName":"Señor Commish","isAvailable":false,"isLocked":true,"byeWeek":9,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"11082","firstName":"Lamar","lastName":"Miller","nflTeam":"HOU ","pos":"RB","opponent":"CHI  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":289.99,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":14080.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":7,"ownedTeamName":"TLowe12","isAvailable":false,"isLocked":true,"byeWeek":4,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":" 8813","firstName":"Jordy","lastName":"Nelson","nflTeam":"GB  ","pos":"WR","opponent":"@JAC "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":254.80,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":0,"ownedTeamName":"","isAvailable":true,"isLocked":true,"byeWeek":7,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"23815","firstName":"Ezekiel","lastName":"Elliott","nflTeam":"DAL ","pos":"RB","opponent":"NYG  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":307.75,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":3,"ownedTeamName":"Señor Commish","isAvailable":false,"isLocked":true,"byeWeek":9,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"13451","firstName":"Alshon","lastName":"Jeffery","nflTeam":"CHI ","pos":"WR","opponent":"@HOU "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":266.30,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":2,"ownedTeamName":"Burton","isAvailable":false,"isLocked":true,"byeWeek":6,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"15123","firstName":"Doug","lastName":"Martin","nflTeam":"TB  ","pos":"RB","opponent":"@ATL "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":251.19,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":10980.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":7,"ownedTeamName":"TLowe12","isAvailable":false,"isLocked":true,"byeWeek":11,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":" 7868","firstName":"Brandon","lastName":"Marshall","nflTeam":"NYJ ","pos":"WR","opponent":"CIN  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":276.20,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":5000.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":10,"ownedTeamName":"GRIMES","isAvailable":false,"isLocked":true,"byeWeek":13,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"9827 ","firstName":"DeMarco","lastName":"Murray","nflTeam":"TEN ","pos":"RB","opponent":"MIN  "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":192.63,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}},{"player":{"salary":0.00,"percentOwned":98.55,"avgPoints":0.00,"ownedTeamId":3,"ownedTeamName":"Señor Commish","isAvailable":false,"isLocked":true,"byeWeek":6,"injuryStatus":"","injuryDescription":"","faStatus":"A","playerId":"14038","firstName":"Mike","lastName":"Evans","nflTeam":"TB  ","pos":"WR","opponent":"@ATL "},"stats":{"ytdFantasyPoints":0.00,"lastFantasyPoints":0.00,"projectedFantasyPoints":244.40,"games":0,"passYards":0,"passTDs":0,"passINTs":0,"rushYards":0,"rushTDs":0,"recYards":0,"recTDs":0,"carries":0,"receptions":0,"targets":0,"fumLost":0,"pats":0,"patsMissed":0,"fgs":0,"fgsMissed":0,"tackles":0,"assists":0,"hSacks":0,"fSacks":0,"ints":0,"safeties":0,"forcedFum":0,"fumRecovered":0,"fumTDs":0,"intTDs":0,"dfPtsAgainst":0,"dfYardsAllowed":0}}]
		// });
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/players",
			params: filters
		});
	}

	function read(leagueId, playerId) {
		return $http({
			method: "GET",
			cache: true,
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/players/" + playerId
		});
	}

	function currentFilters(filters) {
		return AppStateService.currentPlayerFilters(filters) || this.defaultFilters;
	}

	// test whether the filters that you pass, or the currentFilters, equal the default
	function isEmptyFilters(filters) {
		if (arguments.length === 1 && !filters) { return true; }

		if (!filters) {
			filters = currentFilters();
		}

		return _.isEqual(filters, this.defaultFilters);
	}
})

.service("PlayerPositionsService", function ($http, AppSettings, $q, AppStateService) {
	return {
		list: list
	};

	function list(leagueId) {
		if (!leagueId) {
			leagueId = AppStateService.currentLeagueId();
		}

		return $http({
			method: "GET",
			cache: true,
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/player_positions"
		});
	}
})

.service("TeamService", function ($http, AppSettings, _) {
	return {
		fetch: fetch,
		insertPlayer: insertPlayer
	};

	function fetch(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId
		})
		.then(function (response) {
			var data, responseData = response.data, slotted = [];

			data = responseData;

			_.each(data.lineupPlayers, function (player) {
				player.projectedPoints = player.projPoints;
				player.game = {
					opponent: player.opponent,
					// timeRemaining:,
					team: player.nflTeam,
					gameStatus: player.gameStatus/*,
					teamScore:,
					opponentScore:*/
				}
			});

			_.each(data.startingPositions, function (position) {
				if (!position.positionsAllowed || !position.positionsAllowed.length) {
					position.positionsAllowed = [position.startingSlot];
				}

				position.player = _.find(data.lineupPlayers, function (player) {
					return (player.startingSlot || player.pos) == position.startingSlot &&
						player.lineupStatus == 1 &&
						!_.contains( slotted, player.playerId );
				});

				if (!position.player) { return; }

				slotted.push(position.player.playerId);
			});

			data.bench = _.select(data.lineupPlayers, function (player) {
				return player.lineupStatus == 2;
			});

			data.reserves = _.select(data.lineupPlayers, function (player) {
				return player.lineupStatus == 3;
			});

			return { data: data };
		});
	}

	function insertPlayer(leagueId, teamId, position, playerId) {
		var data = [{
			playerId: playerId,
			lineupStatus: position.lineupStatus || 1,
			startingSlot: position.startingSlot
		}];

		if (position.player) {
			data.push({
				playerId: position.player.playerId,
				lineupStatus: 2
			});
		}
		return $http({
			method: "POST",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId,
			data: { changedPlayers: data }
		})
	}
})

.service("GameService", function ($http, AppSettings) {
	return {
		fetch: fetch
	};

	function fetch(leagueId, week, gameId) {
		return $http({
			method: "GET",
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/scoreboards/" + week + "/game_summaries/" + gameId
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/game_summaries/" + gameId
		});
	}
})

.service("HelpService", function ($http, AppSettings) {
	return {
		submitFeedback: submitFeedback
	};

	function submitFeedback (data) {
		return $http({
			method: "POST",
			url: AppSettings.apiHost + "/v1/feedback",
			data: data
		});
	}
})
;