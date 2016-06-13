import {
	DebugSession,
	InitializedEvent, TerminatedEvent, StoppedEvent, BreakpointEvent, OutputEvent, Event,
	Thread, StackFrame, Scope, Source, Handles, Breakpoint
} from 'vscode-debugadapter';
import {DebugProtocol} from 'vscode-debugprotocol';
import {readFileSync} from 'fs';
import * as path from 'path';
import {Jdb, JdbRunningState} from "node-jdb/out/jdb";


/**
 * This interface should always match the schema found in the mock-debug extension manifest.
 */
export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	mainClass: string;
	classesDir: string;
}

class MockDebugSession extends DebugSession {

	static THREAD_ID = 1;
	static _breakPointId = 0;
	breakpointRequests = new Array<DebugProtocol.SetBreakpointsArguments>();

	private jdb: Jdb;

	public constructor() {
		super();

		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);
	}

	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());

		// This debug adapter implements the configurationDoneRequest.
		response.body.supportsConfigurationDoneRequest = true;

		// make VS Code to use 'evaluate' when hovering over source
		response.body.supportsEvaluateForHovers = true;

		this.sendResponse(response);
	}

	protected launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
		var classFile = path.resolve(args.classesDir, args.mainClass.replace(".", "/"));
		this.jdb = new Jdb();
		this.jdb.launch(args.mainClass, {workingDir: args.classesDir, classPath: "."})
		.then(_ => this.enableBreakpoints())
		.then(_ => this.continueRequest(<DebugProtocol.ContinueResponse>response, { threadId: MockDebugSession.THREAD_ID }));
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		super.disconnectRequest(response, args);
	}

	protected enableBreakpoints(args?: DebugProtocol.SetBreakpointsArguments): Promise<any> {
		if(args) {
			let [_, className] = args.source.path.match(/(\w+)\.java/);
		
			return args.breakpoints.reduce((prom, br) => {
				return prom.then(_ => {
					return this.jdb.stopAt(className, br.line);
				});
			}, Promise.resolve());
			
		}
		else {
			return this.breakpointRequests.reduce((prom, req) => {
				return prom.then(_ => {
					return this.enableBreakpoints(req);
				})
			}, Promise.resolve());
		}
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
		
		this.breakpointRequests.push(args)
		this.sendResponse(response);
		return;

		/*
		var path = args.source.path;
		var clientLines = args.lines;

		// read file contents into array for direct access
		var lines = readFileSync(path).toString().split('\n');

		var breakpoints = new Array<Breakpoint>();

		// verify breakpoint locations
		for (var i = 0; i < clientLines.length; i++) {
			var l = this.convertClientLineToDebugger(clientLines[i]);
			var verified = false;
			if (l < lines.length) {
				const line = lines[l].trim();
				// if a line is empty or starts with '+' we don't allow to set a breakpoint but move the breakpoint down
				if (line.length == 0 || line.indexOf("+") == 0)
					l++;
				// if a line starts with '-' we don't allow to set a breakpoint but move the breakpoint up
				if (line.indexOf("-") == 0)
					l--;
				// don't set 'verified' to true if the line contains the word 'lazy'
				// in this case the breakpoint will be verified 'lazy' after hitting it once.
				if (line.indexOf("lazy") < 0) {
					verified = true;    // this breakpoint has been validated
				}
			}
			const bp = <DebugProtocol.Breakpoint> new Breakpoint(verified, this.convertDebuggerLineToClient(l));
			bp.id = this._breakpointId++;
			breakpoints.push(bp);
		}
		this._breakPoints.set(path, breakpoints);

		// send back the actual breakpoint positions
		response.body = {
			breakpoints: breakpoints
		};
		this.sendResponse(response);
		*/
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
		// return the default thread
		response.body = {
			threads: [
				new Thread(MockDebugSession.THREAD_ID, "thread 1")
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		/*
		const frames = new Array<StackFrame>();
		const words = this._sourceLines[this._currentLine].trim().split(/\s+/);
		// create three fake stack frames.
		for (let i= 0; i < 3; i++) {
			// use a word of the line as the stackframe name
			const name = words.length > i ? words[i] : "frame";
			frames.push(new StackFrame(i, `${name}(${i})`, new Source(basename(this._sourceFile), this.convertDebuggerPathToClient(this._sourceFile)), this.convertDebuggerLineToClient(this._currentLine), 0));
		}
		response.body = {
			stackFrames: frames
		};
		this.sendResponse(response);
		*/
		this.sendResponse(response);
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {

		const frameReference = args.frameId;
		const scopes = new Array<Scope>();
		scopes.push(new Scope("Local", 1, false));
		scopes.push(new Scope("Arguments", 2, false));

		response.body = {
			scopes: scopes
		};
		this.sendResponse(response);
	}

	protected variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments): void {
		/*
		const variables = [];
		const id = this._variableHandles.get(args.variablesReference);
		if (id != null) {
			variables.push({
				name: id + "_i",
				value: "123",
				variablesReference: 0
			});
			variables.push({
				name: id + "_f",
				value: "3.14",
				variablesReference: 0
			});
			variables.push({
				name: id + "_s",
				value: "hello world",
				variablesReference: 0
			});
			variables.push({
				name: id + "_o",
				value: "Object",
				variablesReference: this._variableHandles.create("object_")
			});
		}

		response.body = {
			variables: variables
		};
		this.sendResponse(response);
		*/
		this.sendResponse(response);
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {

		this.jdb.cont()
		.then(_ => {
			var state = this.jdb.getState();
			switch(state.running) {
				case JdbRunningState.BREAKPOINT_HIT:
					this.sendEvent(new StoppedEvent("breakpoint", MockDebugSession.THREAD_ID));
					break;
				case JdbRunningState.CAUGHT_EXCEPTION:
				case JdbRunningState.UNCAUGHT_EXCEPTION:
					this.sendEvent(new StoppedEvent("exception", MockDebugSession.THREAD_ID));
					break;
				case JdbRunningState.TERMINATED:
					this.sendEvent(new TerminatedEvent());
					break;
			}

			this.sendResponse(response);
		})

		/*
		// find the breakpoints for the current source file
		const breakpoints = this._breakPoints.get(this._sourceFile);

		for (var ln = this._currentLine+1; ln < this._sourceLines.length; ln++) {

			if (breakpoints) {
				const bps = breakpoints.filter(bp => bp.line === this.convertDebuggerLineToClient(ln));
				if (bps.length > 0) {
					this._currentLine = ln;

					// 'continue' request finished
					this.sendResponse(response);

					// send 'stopped' event
					this.sendEvent(new StoppedEvent("breakpoint", MockDebugSession.THREAD_ID));

					// the following shows the use of 'breakpoint' events to update properties of a breakpoint in the UI
					// if breakpoint is not yet verified, verify it now and send a 'breakpoint' update event
					if (!bps[0].verified) {
						bps[0].verified = true;
						this.sendEvent(new BreakpointEvent("update", bps[0]));
					}
					return;
				}
			}

			// if word 'exception' found in source -> throw exception
			if (this._sourceLines[ln].indexOf("exception") >= 0) {
				this._currentLine = ln;
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("exception", MockDebugSession.THREAD_ID));
				this.sendEvent(new OutputEvent(`exception in line: ${ln}\n`, 'stderr'));
				return;
			}
		}
		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
		*/

	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {

		this.jdb.step()
		.then(_ => {
			this.sendResponse(response);
		});

		/*
		for (let ln = this._currentLine+1; ln < this._sourceLines.length; ln++) {
			if (this._sourceLines[ln].trim().length > 0) {   // find next non-empty line
				this._currentLine = ln;
				this.sendResponse(response);
				this.sendEvent(new StoppedEvent("step", MockDebugSession.THREAD_ID));
				return;
			}
		}
		this.sendResponse(response);
		// no more lines: run to end
		this.sendEvent(new TerminatedEvent());
		*/
	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {

		response.body = {
			result: `evaluate(context: '${args.context}', '${args.expression}')`,
			variablesReference: 0
		};
		this.sendResponse(response);
	}

	protected customRequest(request: string, response: DebugProtocol.Response, args: any): void {
		switch (request) {
		case 'infoRequest':
			response.body = {
				'currentFile': "Foo.bar",
				'currentLine': 42
			};
			this.sendResponse(response);
			break;
		default:
			super.customRequest(request, response, args);
			break;
		}
	}
}

DebugSession.run(MockDebugSession);