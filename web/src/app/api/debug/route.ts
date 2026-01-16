import { NextResponse } from "next/server";
import Datastore from "@seald-io/nedb";
import os from "node:os";
import path from "node:path";

export async function GET() {
	const homedir = os.homedir();
	const dbPath = path.join(homedir, ".tokenpass");
	const filename = `${dbPath}/seed.db`;

	return new Promise<NextResponse>((resolve) => {
		const db = new Datastore({ filename });

		db.loadDatabase((err) => {
			if (err) {
				resolve(NextResponse.json({ error: err.message, filename }));
				return;
			}

			db.count({}, (countErr, count) => {
				if (countErr) {
					resolve(NextResponse.json({ error: countErr.message, filename }));
					return;
				}

				db.findOne({}, (findErr, doc) => {
					resolve(NextResponse.json({
						filename,
						count,
						hasDoc: !!doc,
						docKeys: doc ? Object.keys(doc) : []
					}));
				});
			});
		});
	});
}
