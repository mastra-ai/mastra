// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Page extends APIResource {
    /**
     * Creates a waiting room page preview. Upload a custom waiting room page for
     * preview. You will receive a preview URL in the form
     * `http://waitingrooms.dev/preview/<uuid>`. You can use the following query
     * parameters to change the state of the preview:
     *
     * 1. `force_queue`: Boolean indicating if all users will be queued in the waiting
     *    room and no one will be let into the origin website (also known as queueAll).
     * 2. `queue_is_full`: Boolean indicating if the waiting room's queue is currently
     *    full and not accepting new users at the moment.
     * 3. `queueing_method`: The queueing method currently used by the waiting room.
     *    - **fifo** indicates a FIFO queue.
     *    - **random** indicates a Random queue.
     *    - **passthrough** indicates a Passthrough queue. Keep in mind that the
     *      waiting room page will only be displayed if `force_queue=true` or
     *      `event=prequeueing` — for other cases the request will pass through to the
     *      origin. For our preview, this will be a fake origin website returning
     *      \"Welcome\".
     *    - **reject** indicates a Reject queue.
     * 4. `event`: Used to preview a waiting room event.
     *    - **none** indicates no event is occurring.
     *    - **prequeueing** indicates that an event is prequeueing (between
     *      `prequeue_start_time` and `event_start_time`).
     *    - **started** indicates that an event has started (between `event_start_time`
     *      and `event_end_time`).
     * 5. `shuffle_at_event_start`: Boolean indicating if the event will shuffle users
     *    in the prequeue when it starts. This can only be set to **true** if an event
     *    is active (`event` is not **none**).
     *
     * For example, you can make a request to
     * `http://waitingrooms.dev/preview/<uuid>?force_queue=false&queue_is_full=false&queueing_method=random&event=started&shuffle_at_event_start=true` 6.
     * `waitTime`: Non-zero, positive integer indicating the estimated wait time in
     * minutes. The default value is 10 minutes.
     *
     * For example, you can make a request to
     * `http://waitingrooms.dev/preview/<uuid>?waitTime=50` to configure the estimated
     * wait time as 50 minutes.
     *
     * @example
     * ```ts
     * const response = await client.waitingRooms.page.preview({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   custom_html:
     *     '{{#waitTimeKnown}} {{waitTime}} mins {{/waitTimeKnown}} {{^waitTimeKnown}} Queue all enabled {{/waitTimeKnown}}',
     * });
     * ```
     */
    preview(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/waiting_rooms/preview`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=page.mjs.map