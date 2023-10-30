const axios = require('axios');

exports.main = async (event, callback) => {

  const token = process.env.ccuToken

  const dealId = event.inputFields['hs_object_id'];
  const currentTimestamp = new Date().getTime();
  const twentyFourHoursBefore = currentTimestamp - (24 * 60 * 60 * 1000);

  const options = {
    url: 'https://api.hubapi.com/collector/graphql',
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    data: {
      "operationName": "GetTouchpoints",
      "query": `query GetTouchpoints ($dealId: Number, $twentyFourHoursBefore: DateTime)  {
  CRM {
    deal_collection(filter: {hs_object_id__eq: $dealId}) {
      items {
        associations {
          contact_collection__deal_to_contact(
            filter: {OR: [{hs_email_last_send_date__gte: $twentyFourHoursBefore}, {sakari_message_sent_at__gte: $twentyFourHoursBefore}]}
          ) {
            items {
              hs_email_last_email_name
              hs_email_last_send_date
              sakari_message_sent_at
              associations {
                engagement_collection__contact_to_engagement(
                  filter: {hs_engagement_type__not_in: ["TASK", "NOTE", "INCOMING_EMAIL"], hs_createdate__gte: $twentyFourHoursBefore}
                ) {
                  items {
                    hs_engagement_type
                    hs_call_direction
                    hs_createdate
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

`,
      "variables": {"dealId": dealId,"twentyFourHoursBefore": twentyFourHoursBefore}
    }
  };

  axios(options)
    .then(response => {

    const inputJson = response.data.data.CRM

    const engagements = [];

    if (inputJson.deal_collection.items && inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact && inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact.items[0]) {
      const emailLastSendDate = inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact.items[0].hs_email_last_send_date;
      if (emailLastSendDate !== null && emailLastSendDate !== undefined) {
        engagements.push({ 'Automated email': emailLastSendDate });
      }
    }

    if (inputJson.deal_collection.items && inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact && inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact.items[0]) {
      const sakariMessageSentAt = inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact.items[0].sakari_message_sent_at;
      if (sakariMessageSentAt !== null && sakariMessageSentAt !== undefined) {
        engagements.push({ 'Sakari sms': sakariMessageSentAt });
      }
    }

    if (inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact.items[0]) {
      console.log("toto")
      const engagementItems = inputJson.deal_collection.items[0].associations.contact_collection__deal_to_contact.items[0].associations.engagement_collection__contact_to_engagement.items;
      if (engagementItems !== null && engagementItems !== undefined) {

        engagementItems.forEach((engagement) => {
          let key = engagement.hs_engagement_type.label;
          if (engagement.hs_call_direction) {
            let callDirection = engagement.hs_call_direction.label
            key += ` - ${callDirection}`;
          }

          const value = engagement.hs_createdate;
          engagements.push({ [key]: value });
        });
      }
    }

    console.log(engagements);

    if (engagements.length > 0) {
      let maxTimestamp = -1;
      let mostRecentKey = null;

      engagements.forEach(engagement => {
        for (const key in engagement) {
          if (engagement[key] > maxTimestamp) {
            maxTimestamp = engagement[key];
            mostRecentKey = key;
          }
        }
      });

      console.log("Most recent engagement:", mostRecentKey);
      callback({
        outputFields: {
          attribution: mostRecentKey
        }
      });
    } else {
      callback({
        outputFields: {
          attribution: "No attribution"
        }
      });
    }

  })
    .catch(error => {
    throw new Error(error);
  });


}
