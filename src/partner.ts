import { SignedClient } from './base.js';
import * as body from './body.js';
import { Client } from './client.js';
import type * as Request from './request.js';
import * as Response from './response.js';

/**
 * The address the application is reached at and the partner's own
 * credentials, the ones Ayarlar → İş Ortaklığı shows. They open, ask after,
 * switch and delete the partner's teams, and nothing inside a team: that
 * is done with the team's own credentials, through its `Client`.
 */
export interface PartnerOptions {
    /** The address the application is served from, e.g. https://sandbox.odemehub.com while building and https://app.odemehub.com once live. */
    baseUrl: string;
    apiKey: string;
    apiSecret: string;
    /** How long a request may take, in milliseconds. Left out, a minute. */
    timeout?: number;
    /** The fetch the requests go through. Left out, Node's own. */
    fetch?: typeof fetch;
}

/**
 * The partner API, as a partner's application talks to it, to run the
 * teams it opens for its own customers. Requests are signed and answers
 * checked the way the gateway's are, with the partner's secret.
 *
 * There is one method per endpoint, named after it: `create-team` is
 * `createTeam()`. A team is named by its slug, the ten-digit number its
 * gateway address carries; a team the partner did not open is not found.
 */
export class PartnerClient extends SignedClient {
    constructor(private readonly options: PartnerOptions) {
        super(options);
    }

    /**
     * Open a team, free, with the modules asked for. The answer carries
     * the team's own credentials; keep them, and reach the team with
     * `teamClient()`.
     */
    async createTeam(team: Request.CreateTeam = {}): Promise<Response.PartnerTeamDetails> {
        return Response.PartnerTeamDetails.fromBody(await this.send(body.createTeam(team)));
    }

    /**
     * The partner's teams as they stand, each with its credentials — by
     * slug, or every team it opened when none is named.
     */
    async retrieveTeams(teams: Request.RetrieveTeams = {}): Promise<Response.PartnerTeamList> {
        return Response.PartnerTeamList.fromBody(await this.send(body.retrieveTeams(teams)));
    }

    /**
     * Leave a team with exactly the modules sent.
     */
    async updateTeamModules(team: Request.UpdateTeamModules): Promise<Response.PartnerTeamDetails> {
        return Response.PartnerTeamDetails.fromBody(await this.send(body.updateTeamModules(team)));
    }

    /**
     * Delete a team for good, with everything in it.
     */
    async deleteTeam(team: Request.DeleteTeam): Promise<Response.DeletedTeam> {
        return Response.DeletedTeam.fromBody(await this.send(body.deleteTeam(team)));
    }

    /**
     * The gateway client of one of the partner's teams: the same address,
     * the team's slug and its own credentials, as `createTeam()` and
     * `retrieveTeams()` hand them over.
     */
    teamClient(team: Pick<Response.PartnerTeam, 'slug' | 'apiKey' | 'apiSecret'>): Client {
        return new Client({
            baseUrl: this.options.baseUrl,
            team: team.slug,
            apiKey: team.apiKey,
            apiSecret: team.apiSecret,
            timeout: this.options.timeout,
            fetch: this.options.fetch,
        });
    }

    /**
     * The path of a partner endpoint, as it is signed: with its leading
     * slash and nothing in front of it.
     */
    protected path(endpoint: string): string {
        return `/api/partner/${endpoint}`;
    }
}
