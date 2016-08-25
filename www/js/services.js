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

	var OPENING_NIGHT = moment("2016-09-08");
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
			// myroster: "My Roster",
			available: "Available"
		},
		currentFilters: currentFilters,
		isEmptyFilters: isEmptyFilters
	};

	function list(leagueId, filters) {
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
		if (!filters) {
			if (arguments.length > 0) { return true; }

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
		news: news,

		fetchRoster: fetchRoster,
		fetchAdjustableRoster: fetchAdjustableRoster,
		insertPlayer: insertPlayer,

		listBids: listBids,
		createBid: createBid,
		updateBid: updateBid,
		destroyBid: destroyBid
	};

	function news(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/news"
		});
	}

	function fetchRoster(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/rostered_players"
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
					position.positionsAllowed = [position.slotLabel];
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

	function fetchAdjustableRoster(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/adjustable_players"
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
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/rostered_players",
			data: { changedPlayers: data }
		})
	}

	function listBids(leagueId, teamId) {
		return $http({
			method: "GET",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids"
		});
	}

	function createBid(leagueId, teamId, formData) {
		return $http({
			method: "POST",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids",
			data: { bid: formData }
		});
	}

	function updateBid(leagueId, teamId, acquisitionId, formData) {
		return $http({
			method: "PUT",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids/" + bidId,
			data: { bid: formData }
		});
	}

	function destroyBid(leagueId, teamId, acquisitionId) {
		return $http({
			method: "DELETE",
			url: AppSettings.apiHost + "/v3/leagues/" + leagueId + "/teams/" + teamId + "/bids/" + bidId
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