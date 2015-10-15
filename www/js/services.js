angular.module("starter.services", [])
.service("LeagueService", function ($http, $q, AppSettings, AppStateService, CacheService, AuthTokenStore) {
	var previousSession;

	return {
		list: list,
		set: set
	};

	function list (force) {
		var leaguesData = CacheService.leagues(), deferred;

		if (!force && leaguesData && leaguesData.leagues && leaguesData.leagues.length) {
			return $q.resolve(leaguesData);
		}

		deferred = $q.defer();

		$http({
			method: "GET",
			url: AppSettings.apiHost + "/v1/leagues"
		}).then(function (response) {
			deferred.resolve(CacheService.leagues({
				lastUpdated: new Date(),
				leagues: response.data
			}));
		}, function () {
			deferred.reject.apply(deferred, arguments);
		});

		return deferred.promise;
	}

	function set (leagueId, force) {
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
			url: AppSettings.apiHost + "/v1/tokens",
			data: data
		});
	}
})

.service("CacheService", function (/* $localStorage */) {
	var STORE_KEY_LEAGUES;

	STORE_KEY_LEAGUES = "realitySportsApp.Cache>leagues";

	return {
		leagues: leagues
	};

	function leagues(leaguesData) {
		if (leaguesData) {
			localStorage.setItem(STORE_KEY_LEAGUES, JSON.stringify(leaguesData));
		}

		return JSON.parse(localStorage.getItem(STORE_KEY_LEAGUES) || "[]");
	}
})

.service("AppStateService", function () {
	var STORE_KEY_CURRENT_LEAGUE, STORE_KEY_LEAGUES, STORE_KEY_CURRENT_WEEK, STORE_KEY_CURRENT_EMAIL;

	STORE_KEY_CURRENT_LEAGUE = "realitySportsApp.AppState>currentLeagueId";
	STORE_KEY_LEAGUES = "realitySportsApp.AppState>leagues";
	STORE_KEY_CURRENT_WEEK = "realitySportsApp.AppState>currentWeek";
	STORE_KEY_CURRENT_EMAIL = "realitySportsApp.AppState>currentEmail";

	return {
		currentLeagueId: currentLeagueId,
		clearCurrentLeagueId: clearCurrentLeagueId,
		currentWeek: currentWeek,
		currentEmail: currentEmail
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

	function fetch (leagueId, week, gameId) {
		if (!week) {
			week = AppStateService.currentWeek() || "";
		}

		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/scoreboards/" + week
		});
	}
})

.service("StandingsService", function ($http, AppSettings) {
	return {
		fetch: fetch
	};

	function fetch (leagueId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/standings"
		});
	}
})

.service("GameService", function ($http, AppSettings) {
	return {
		fetch: fetch
	};

	function fetch (leagueId, week, gameId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v1/leagues/" + leagueId + "/scoreboards/" + week + "/game_summaries/" + gameId
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