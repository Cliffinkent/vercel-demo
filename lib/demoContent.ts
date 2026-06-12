export const defaultProfile = {
  parentName: "Alex",
  childName: "Sam",
  childAge: 8,
  schoolName: "Oakfield Primary",
  schoolWebsiteUrl: "https://oakfield-primary.example",
};

export const sampleMessages = {
  trip: {
    label: "Trip email",
    sourceType: "pasted_email",
    text: `Subject: Year 3 Science Museum trip

Dear parents and carers,

Year 3 will visit the Science Museum on Tuesday 17 June. The coach leaves Oakfield Primary at 9:15am and returns before pickup.

The trip costs £8.50. Please pay and return the permission form by Friday 13 June.

Children should wear school uniform and bring a packed lunch in a named bag.

Thank you,
Oakfield Primary Office`,
  },
  pe: {
    label: "PE reminder",
    sourceType: "pasted_email",
    text: `Reminder: Sam's class needs PE kit next Wednesday for athletics practice.

Please bring trainers, water bottle and sun hat. No payment is needed.`,
  },
  newsletter: {
    label: "Newsletter",
    sourceType: "newsletter",
    text: `Oakfield Primary weekly newsletter

INSET day on Monday 23 June. School is closed to pupils.

After-school club sign up closes by Thursday 19 June.

Cake sale in the school hall on Friday 20 June. Please bring nut-free cakes if you can.

Non-uniform day is Friday 27 June. Suggested donation £1.`,
  },
  lunch: {
    label: "Lunch menu",
    sourceType: "lunch_menu",
    text: `Lunch menu

Monday 16 June: Tomato pasta bake. Allergens: wheat, milk.
Tuesday 17 June: Jacket potato with beans. Allergens: none listed.
Wednesday 18 June: Chicken curry with rice. Allergens: mustard.
Thursday 19 June: Fish fingers and peas. Allergens: fish, wheat.
Friday 20 June: Vegetarian pizza. Allergens: wheat, milk.`,
  },
} as const;
