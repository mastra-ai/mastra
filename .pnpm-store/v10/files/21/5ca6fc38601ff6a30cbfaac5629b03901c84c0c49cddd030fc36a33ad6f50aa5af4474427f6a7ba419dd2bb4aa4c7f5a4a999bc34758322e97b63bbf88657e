import { subscribe } from "./subscribe/helpers.mjs";
import "./subscribe/index.mjs";
import { useEffect, useRef, useState } from "react";

//#region src/hooks.ts
let InngestSubscriptionState = /* @__PURE__ */ function(InngestSubscriptionState$1) {
	InngestSubscriptionState$1["Closed"] = "closed";
	InngestSubscriptionState$1["Error"] = "error";
	InngestSubscriptionState$1["RefreshingToken"] = "refresh_token";
	InngestSubscriptionState$1["Connecting"] = "connecting";
	InngestSubscriptionState$1["Active"] = "active";
	InngestSubscriptionState$1["Closing"] = "closing";
	return InngestSubscriptionState$1;
}({});
/**
* TODO
*/
function useInngestSubscription({ token: tokenInput, refreshToken, key, enabled = true, bufferInterval = 0 }) {
	const [token, setToken] = useState(tokenInput);
	const [data, setData] = useState([]);
	const [freshData, setFreshData] = useState([]);
	const [error, setError] = useState(null);
	const [state, setState] = useState(InngestSubscriptionState.Closed);
	const subscriptionRef = useRef(null);
	const readerRef = useRef(null);
	const messageBuffer = useRef([]);
	const bufferIntervalRef = useRef(bufferInterval);
	useEffect(() => {
		if (tokenInput) setToken(tokenInput);
	}, [tokenInput]);
	useEffect(() => {
		if (!token && enabled) if (refreshToken) {
			setState(InngestSubscriptionState.RefreshingToken);
			refreshToken().then((newToken) => setToken(newToken)).catch((err) => {
				setError(err);
				setState(InngestSubscriptionState.Error);
			});
		} else {
			setError(/* @__PURE__ */ new Error("No token provided and no refreshToken handler."));
			setState(InngestSubscriptionState.Error);
		}
	}, []);
	useEffect(() => {
		setError(null);
		if (!enabled || !token) return;
		let cancelled = false;
		const start = async () => {
			try {
				setState(InngestSubscriptionState.Connecting);
				const stream = await subscribe({ ...token });
				if (cancelled) return;
				subscriptionRef.current = stream;
				setState(InngestSubscriptionState.Active);
				const reader = stream.getReader();
				readerRef.current = reader;
				try {
					while (!cancelled) {
						const { done, value } = await reader.read();
						if (done || cancelled) break;
						if (bufferIntervalRef.current === 0) {
							setFreshData([value]);
							setData((prev) => [...prev, value]);
						} else messageBuffer.current.push(value);
					}
				} finally {
					try {
						reader.releaseLock();
					} catch {}
					readerRef.current = null;
				}
				if (!cancelled) {
					setState(InngestSubscriptionState.Closed);
					if (enabled) start();
				}
			} catch (err) {
				if (cancelled) return;
				if (refreshToken) {
					setState(InngestSubscriptionState.RefreshingToken);
					refreshToken().then((newToken) => setToken(newToken)).catch((e) => {
						setError(e);
						setState(InngestSubscriptionState.Error);
					});
				} else {
					setError(err);
					setState(InngestSubscriptionState.Error);
				}
			}
		};
		start();
		return () => {
			cancelled = true;
			const cleanup = async () => {
				const readerToRemove = readerRef.current;
				const subToRemove = subscriptionRef.current;
				readerRef.current = null;
				subscriptionRef.current = null;
				try {
					await readerToRemove?.cancel();
				} catch {}
				try {
					readerToRemove?.releaseLock();
				} catch {}
				try {
					await subToRemove?.cancel();
				} catch {}
			};
			cleanup().catch((err) => {
				console.error("Error cleaning up Inngest subscription", err);
			}).finally(() => {
				setState(InngestSubscriptionState.Closed);
			});
		};
	}, [
		token,
		enabled,
		key
	]);
	useEffect(() => {
		bufferIntervalRef.current = bufferInterval;
		let interval = null;
		if (bufferInterval > 0) interval = setInterval(() => {
			if (messageBuffer.current.length > 0) {
				const buffered = [...messageBuffer.current];
				messageBuffer.current = [];
				setFreshData(buffered);
				setData((prev) => [...prev, ...buffered]);
			}
		}, bufferInterval);
		return () => {
			if (interval) clearInterval(interval);
		};
	}, [bufferInterval]);
	return {
		data,
		latestData: data[data.length - 1] ?? null,
		freshData,
		error,
		state
	};
}

//#endregion
export { InngestSubscriptionState, useInngestSubscription };
//# sourceMappingURL=hooks.mjs.map