/**
 * Fallback message templates — used when AI is unavailable.
 * The AI generates better versions; these are just safety nets.
 */

export interface TemplateVars {
  title: string;
  year?: string;
  price?: string;
  offer?: string;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function getInitialTemplate(vars: TemplateVars): string {
  const templates = [
    `Hi, is the ${vars.title} still available? Can you send more photos and the auction sheet?`,
    `Hey, saw your ${vars.title} on Bazaraki. What's the current mileage? And do you have the auction sheet?`,
    `Hi there! Interested in your ${vars.title}. Is it a Japanese import? Do you have the auction sheet/history?`,
    `Hello, is the ${vars.title} still for sale? I'd like to see the auction sheet before coming to view it.`,
  ];
  return pick(templates);
}

export function getAuctionSheetTemplate(): string {
  return pick([
    'Can you send the auction sheet? Want to verify the mileage before coming to see it.',
    'Do you have the auction report for this car? It helps a lot with the decision.',
    'One more thing — do you have the Japanese auction sheet? Just want to check the mileage matches.',
  ]);
}

export function getNegotiateTemplate(vars: TemplateVars): string {
  return pick([
    `Thanks for the info. I like the car but ${vars.price} is a bit above what I see for similar ones. Would you consider ${vars.offer}?`,
    `Looks good! My budget is around ${vars.offer} for this type of car — is there any room to negotiate?`,
    `I've been looking at a few options and ${vars.price} is on the higher side. Could we work with ${vars.offer}?`,
  ]);
}

export function getWalkAwayTemplate(): string {
  return pick([
    "Thanks for the info, I'll think about it and get back to you.",
    'Appreciate your time. Let me check a couple more options and I\'ll let you know.',
    "Ok thanks. I'll be in touch if I decide to go ahead.",
  ]);
}
