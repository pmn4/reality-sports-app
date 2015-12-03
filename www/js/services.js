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

		return teamLogos[team.teamId];
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

	var OPENING_NIGHT = moment("2015-09-09");
	var WEEK  = 24 * 60 * 60 * 1000;

	return {
		currentLeagueId: currentLeagueId,
		clearCurrentLeagueId: clearCurrentLeagueId,
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
			// url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/standings"
			url: AppSettings.apiHost + "/v2/leagues/" + leagueId + "/weeks/" + week + "/standings"
		});
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