// var API_HOST = "http://localhost:1212";
var API_HOST = "http://reality-sports-app.herokuapp.com";

angular.module("starter.services", [])
.service("LeagueService", function ($http, $q, AuthService /*, $localStorage */) {
	var STORE_KEY_CURRENT_LEAGUE;

	STORE_KEY_CURRENT_LEAGUE = "realitySportsApp.LeagueService>currentLeagueId";

	return {
		list: list,
		set: set,
		currentLeagueId: currentLeagueId
	};

	function list () {
		return $http({
			method: "GET",
			url: API_HOST + "/v1/leagues",
			headers: {
				"X-RSO-Auth-Token": AuthService.token(),
				"X-RSO-Session": AuthService.session()
			}
		});
	}

	function set (leagueId, force) {
		// this call is expensive, so 200 OK! if it's a repeat request
		if (leagueId === currentLeagueId() && !force) {
			return $q.resolve();
		}

		return $http({
			method: "PUT",
			url: API_HOST + "/v1/leagues/" + leagueId,
			headers: {
				"X-RSO-Auth-Token": AuthService.token(),
				"X-RSO-Session": AuthService.session()
			}
		}).then(function (response) {
			currentLeagueId(leagueId);

			AuthService.token(response.data.token);
			AuthService.session(response.data.session);
		});
	}

	function currentLeagueId (leagueId) {
		if (leagueId) {
			localStorage.setItem(STORE_KEY_CURRENT_LEAGUE, leagueId);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_LEAGUE);
	}
})

.service("AuthService", function (/* $localStorage, */ $http) {
	var STORE_KEY_TOKEN, STORE_KEY_SESSION, STORE_KEY_CURRENT_EMAIL;

	STORE_KEY_TOKEN = "realitySportsApp.AuthService>token";
	STORE_KEY_SESSION = "realitySportsApp.AuthService>session";
	STORE_KEY_CURRENT_EMAIL = "realitySportsApp.AuthService>currentEmail";

	return {
		token: token,
		session: session,
		login: login,
		currentEmail, currentEmail
	};

	function token (t) {
		if (t) {
			localStorage.setItem(STORE_KEY_TOKEN, t);
		}

		return localStorage.getItem(STORE_KEY_TOKEN);
	}

	function session (s) {
		if (s) {
			localStorage.setItem(STORE_KEY_SESSION, s);
		}

		return localStorage.getItem(STORE_KEY_SESSION);
	}

	function currentEmail (e) {
		if (e) {
			localStorage.setItem(STORE_KEY_CURRENT_EMAIL, e);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_EMAIL);
	}

	function login (data) {
		return $http({
			method: "POST",
			url: API_HOST + "/v1/tokens",
			data: data,
			headers: {
				"X-RSO-Session": session()
			}
		}).then(function (response) {
			token(response.data.token);
			session(response.data.session);
		});
	}
})

.service("ScoreboardService", function ($http, AuthService, LeagueService) {
	var STORE_KEY_CURRENT_WEEK;

	STORE_KEY_CURRENT_WEEK = "realitySportsApp.ScoreboardService>currentWeek";

	return {
		fetch: fetch,
		currentWeek: currentWeek
	};

	function fetch (week, gameId) {
		if (!week) {
			week = currentWeek() || "";
		}

		return $http({
			method: "GET",
			url: API_HOST + "/v1/leagues/" + LeagueService.currentLeagueId() + "/scoreboards/" + week,
			headers: {
				"X-RSO-Auth-Token": AuthService.token(),
				"X-RSO-Session": AuthService.session()
			}
		});
	}

	function currentWeek (leagueId) {
		if (leagueId) {
			localStorage.setItem(STORE_KEY_CURRENT_WEEK, leagueId);
		}

		return localStorage.getItem(STORE_KEY_CURRENT_WEEK);
	}
})

.service("GameService", function ($http, AuthService, LeagueService) {
	return {
		fetch: fetch
	};

	function fetch (week, gameId) {
		return $http({
			method: "GET",
			url: API_HOST + "/v1/leagues/" + LeagueService.currentLeagueId() + "/scoreboards/" + week + "/game_summaries/" + gameId,
			headers: {
				"X-RSO-Auth-Token": AuthService.token(),
				"X-RSO-Session": AuthService.session()
			}
		});
	}
})

.service("HelpService", function ($http) {
	return {
		submitFeedback: submitFeedback
	};

	function submitFeedback (data) {
		return $http({
			method: "POST",
			url: API_HOST + "/v1/feedback",
			data: data
		});
	}
})
;