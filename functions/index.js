const {onSchedule} = require(
    "firebase-functions/v2/scheduler",
);
const {defineSecret} = require(
    "firebase-functions/params",
);
const admin = require("firebase-admin");
const webpush = require("web-push");

admin.initializeApp();
const db = admin.firestore();

const VAPID_PVT_KEY = defineSecret("VAPID_PRIVATE_KEY");
const PUB_KEY = "BCwEg_e7sfaT0oEGIkJwS2MRG3RbLwYGdHKTNI3bdpan" +
    "5ZoR8G2UFm_C1Iy0JpWtdjKGywcKknQMYtDjPaS2Hks";

exports.checkSessionBreakReminders = onSchedule(
    {
      schedule: "* * * * *",
      secrets: [VAPID_PVT_KEY],
    },
    async (event) => {
      webpush.setVapidDetails(
          "mailto:admin@example.com",
          PUB_KEY,
          VAPID_PVT_KEY.value(),
      );

      const now = Date.now();
      const thresholdMs = 60000;

      const snapshot = await db
          .collectionGroup("activeSessions")
          .where("breakNotified", "==", false)
          .get();

      if (snapshot.empty) return;

      const promises = snapshot.docs.map(
          async (sessionDoc) => {
            const session = sessionDoc.data();
            const start = new Date(
                session.startTime,
            ).getTime();

            if (now - start >= thresholdMs) {
              const uid = session.userId ||
              sessionDoc.ref.parent.parent.id;
              const uDoc = await db
                  .collection("users")
                  .doc(uid)
                  .get();
              const uData = uDoc.data();
              const sub = uData ?
              uData.pushSubscription : null;

              if (sub) {
                const payload = JSON.stringify({
                  title: "Poker Break 🚨",
                  body: "Time for a break!",
                });

                try {
                  await webpush.sendNotification(
                      sub,
                      payload,
                  );
                  await sessionDoc.ref.update({
                    breakNotified: true,
                  });
                } catch (err) {
                  console.error(err);
                }
              }
            }
          },
      );

      await Promise.all(promises);
    },
);
