#!/usr/bin/env bun
import os from "node:os";
import { init } from "../src/index.ts";

const homedir = os.homedir();
init({ db: `${homedir}/.tokenpass` });
